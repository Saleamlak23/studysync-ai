import { expect, test, type Page } from '@playwright/test';
import { MockApi } from './mockApi.js';

const password = 'study-sync-password';
let emailSequence = 0;
let mock: MockApi;

function nextEmail(prefix: string): string {
  emailSequence += 1;
  return `${prefix}-${Date.now()}-${emailSequence}@example.test`;
}

async function register(page: Page, name: string, email = nextEmail('student')): Promise<string> {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).not.toHaveURL(/\/register$/);
  return email;
}

async function createWorkspace(page: Page, name = 'Study group'): Promise<string> {
  await page.goto('/workspaces');
  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByLabel('Workspace name').fill(name);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+/);
  const workspaceId = new URL(page.url()).pathname.match(/\/w\/([^/]+)/)?.[1];
  if (!workspaceId) throw new Error('Workspace route did not include an ID');
  return workspaceId;
}

async function createInvite(page: Page, workspaceId: string): Promise<string> {
  await page.goto(`/w/${workspaceId}/settings`);
  await page.getByRole('button', { name: 'Create invite link' }).click();
  const invite = page.getByRole('textbox', { name: /Invite link created/ });
  await expect(invite).toBeVisible();
  const link = await invite.inputValue();
  return new URL(link).pathname;
}

async function enableWorkspaceAi(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/w/${workspaceId}/settings`);
  const consent = page.getByRole('checkbox', { name: 'Enable AI for this workspace' });
  await consent.click();
  await expect(consent).toBeChecked();
}

async function addCard(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Add card' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create card' }).click();
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  mock = new MockApi();
  await mock.install(page);
});

test('TC-WS-01: creates a workspace and renders the board at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await register(page, 'Aster Student');
  const workspaceId = await createWorkspace(page, 'Mobile study group');
  await page.goto(`/w/${workspaceId}/board`);

  await expect(page.getByRole('heading', { name: 'To do' })).toBeVisible();
  await expect(page.getByText('No cards in this list yet.').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('TC-WS-02: creates an invite link and joins a second account as a member', async ({ page, browser }) => {
  await register(page, 'Workspace Owner');
  const workspaceId = await createWorkspace(page);
  const invitePath = await createInvite(page, workspaceId);

  const memberPage = await browser.newPage();
  await mock.install(memberPage);
  await register(memberPage, 'Team Member');
  await memberPage.goto(invitePath);
  await memberPage.getByRole('button', { name: 'Join workspace' }).click();
  await expect(memberPage).toHaveURL(new RegExp(`/w/${workspaceId}`));

  await memberPage.goto(`/w/${workspaceId}/chat`);
  await expect(memberPage.getByRole('heading', { name: 'general' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'New channel' })).toHaveCount(0);
  await memberPage.goto(`/w/${workspaceId}/settings`);
  await expect(memberPage.getByRole('button', { name: 'Create invite link' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: 'Archive workspace' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: /Remove / })).toHaveCount(0);

  const outsiderPage = await browser.newPage();
  await mock.install(outsiderPage);
  await register(outsiderPage, 'Workspace Outsider');
  await outsiderPage.goto(`/w/${workspaceId}/board`);
  await expect(outsiderPage.getByRole('main').getByRole('alert')).toContainText('We could not find that.');
  await outsiderPage.close();
  await memberPage.close();
});

test('TC-CHAT-02: broadcasts a message to another channel member and delivers a mention notification', async ({ page, browser }) => {
  await register(page, 'Workspace Owner');
  const workspaceId = await createWorkspace(page);
  const invitePath = await createInvite(page, workspaceId);

  const memberEmail = nextEmail('member');
  const memberPage = await browser.newPage();
  await mock.install(memberPage);
  await register(memberPage, 'Team Member', memberEmail);
  await memberPage.goto(invitePath);
  await memberPage.getByRole('button', { name: 'Join workspace' }).click();
  await expect(memberPage).toHaveURL(new RegExp(`/w/${workspaceId}`));

  const channelId = mock.channelIdFor(workspaceId);
  if (!channelId) throw new Error('Workspace did not create its general channel');
  await page.goto(`/w/${workspaceId}/chat/${channelId}`);
  await memberPage.goto(`/w/${workspaceId}/chat/${channelId}`);
  const composer = page.getByRole('textbox', { name: 'Message #general' });
  await composer.fill('@Team');
  await page.getByRole('button', { name: 'Team Member' }).click();
  await composer.pressSequentially(' please review the outline');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(memberPage.getByText('please review the outline')).toBeVisible();
  await memberPage.getByRole('button', { name: 'Notifications' }).click();
  await expect(memberPage.getByText('You were mentioned.')).toBeVisible();
  await memberPage.close();
});

test('TC-FILE-03: uploads a chat attachment, lists and downloads it, and denies outsiders', async ({ page, browser }) => {
  await register(page, 'File Owner');
  const workspaceId = await createWorkspace(page);
  const channelId = mock.channelIdFor(workspaceId);
  if (!channelId) throw new Error('Workspace did not create its general channel');
  await page.goto(`/w/${workspaceId}/chat/${channelId}`);

  await page.getByLabel('Attach file').setInputFiles({
    name: 'study-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Notes for our study session'),
  });
  await expect(page.getByText('Attached: study-notes.txt')).toBeVisible();
  await page.getByRole('textbox', { name: 'Message #general' }).fill('Please review these notes');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Please review these notes')).toBeVisible();
  await expect(page.getByText('study-notes.txt', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Files', exact: true }).click();

  const workspaceFiles = page.getByRole('list', { name: 'Workspace files' });
  await expect(workspaceFiles.getByText('study-notes.txt')).toBeVisible();
  const download = page.waitForEvent('download');
  await workspaceFiles.getByRole('button', { name: 'Download study-notes.txt' }).click();
  expect((await download).suggestedFilename()).toBe('study-notes.txt');

  const outsiderPage = await browser.newPage();
  await mock.install(outsiderPage);
  const outsiderEmail = await register(outsiderPage, 'File Outsider');
  const fileId = mock.fileIdFor(workspaceId, 'study-notes.txt');
  const token = mock.accessTokenFor(outsiderEmail);
  if (!fileId || !token) throw new Error('File or outsider session was not recorded by the mock API');
  const status = await outsiderPage.evaluate(async ({ fileId, token }) => {
    const result = await fetch(`/api/v1/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } });
    return result.status;
  }, { fileId, token });
  expect(status).toBe(404);
  await outsiderPage.close();
});

test('TC-NOT-01: receives deadline notifications and marks them read', async ({ page }) => {
  const email = await register(page, 'Deadline Student');
  const workspaceId = await createWorkspace(page);
  const userId = mock.userIdFor(email);
  if (!userId) throw new Error('Registered user was not recorded by the mock API');
  mock.seedDeadlineFor(userId, workspaceId);
  await page.goto('/notifications');

  await expect(page.getByText('A card deadline is approaching.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByText('Read', { exact: true })).toBeVisible();
});

test('TC-AI-01 and TC-AI-03: summarizes a selected card only after workspace consent', async ({ page }) => {
  await register(page, 'AI Student');
  const workspaceId = await createWorkspace(page);
  await page.goto(`/w/${workspaceId}/board`);
  await expect(page.getByText('AI is off for this workspace.')).toBeVisible();
  await enableWorkspaceAi(page, workspaceId);
  await page.goto(`/w/${workspaceId}/board`);
  await addCard(page, 'Review the lecture notes');
  await page.getByRole('button', { name: 'Summarize selected item' }).click();

  await expect(page.getByText('A concise summary of the selected study context.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI summary' })).toContainText('Provider: gemini');
});

test('TC-TASK-04: broadcasts card moves to a second member and refetches missed moves after reconnect', async ({ page, browser }) => {
  await register(page, 'Board Owner');
  const workspaceId = await createWorkspace(page);
  const cardTitle = 'Move the shared study card';
  const secondCardTitle = 'Review the shared study notes';
  await page.goto(`/w/${workspaceId}/board`);
  await addCard(page, cardTitle);
  await addCard(page, secondCardTitle);
  const invitePath = await createInvite(page, workspaceId);

  const memberPage = await browser.newPage();
  await mock.install(memberPage);
  const memberEmail = await register(memberPage, 'Board Member');
  await memberPage.goto(invitePath);
  await memberPage.getByRole('button', { name: 'Join workspace' }).click();
  await expect(memberPage).toHaveURL(new RegExp(`/w/${workspaceId}`));
  await memberPage.goto(`/w/${workspaceId}/board`);
  await expect(memberPage.getByRole('button', { name: cardTitle, exact: true })).toBeVisible();

  await page.goto(`/w/${workspaceId}/board`);
  await Promise.all([
    page.getByRole('combobox', { name: `Move ${cardTitle} to list` }).first().selectOption({ label: 'Done' }),
    memberPage.getByRole('combobox', { name: `Move ${secondCardTitle} to list` }).first().selectOption({ label: 'Done' }),
  ]);
  await expect(page.getByRole('region', { name: 'Done' }).getByRole('button', { name: cardTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Done' }).getByRole('button', { name: secondCardTitle, exact: true })).toBeVisible();
  await expect(memberPage.getByRole('region', { name: 'Done' }).getByRole('button', { name: cardTitle, exact: true })).toBeVisible();
  await expect(memberPage.getByRole('region', { name: 'Done' }).getByRole('button', { name: secondCardTitle, exact: true })).toBeVisible();

  const memberId = mock.userIdFor(memberEmail);
  const cardId = mock.cardIdForTitle(workspaceId, cardTitle);
  if (!memberId || !cardId) throw new Error('Member or card was not recorded by the mock API');
  await expect.poll(() => mock.connectedWorkspaceSocketCountFor(memberId, workspaceId)).toBeGreaterThan(0);
  mock.disconnectSocketsFor(memberId);
  mock.moveCardWithoutEvent(workspaceId, cardId, 'To do');
  await expect.poll(() => mock.connectedWorkspaceSocketCountFor(memberId, workspaceId)).toBeGreaterThan(0);
  await expect(memberPage.getByRole('region', { name: 'To do' }).getByRole('button', { name: cardTitle, exact: true })).toBeVisible();
  await expect(memberPage.getByRole('region', { name: 'Done' }).getByRole('button', { name: secondCardTitle, exact: true })).toBeVisible();
  await memberPage.close();
});

test('TC-AI-04 and TC-AI-08: previews editable breakdown cards, preserves failed previews, then confirms', async ({ page }) => {
  await register(page, 'Breakdown Student');
  const workspaceId = await createWorkspace(page);
  await enableWorkspaceAi(page, workspaceId);
  await page.goto(`/w/${workspaceId}/board`);
  await page.getByRole('button', { name: 'Break down a project' }).click();
  await page.getByLabel('Describe the project or goal').fill('Plan a study group project.');
  mock.failNextBreakdownPreview();
  await page.getByRole('button', { name: 'Generate preview' }).click();
  await expect(page.getByRole('alert')).toContainText('The AI could not answer.');
  expect(mock.cardCountFor(workspaceId)).toBe(0);

  await page.getByRole('button', { name: 'Generate preview' }).click();
  await expect(page.getByRole('region', { name: 'Breakdown preview' })).toBeVisible();
  await expect(page.getByText('Nothing is created until you confirm.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Title 1' }).fill('Edited study task');
  await page.getByRole('button', { name: 'Create 2 cards' }).click();

  await expect(page.getByRole('dialog', { name: 'Break down a project' })).toHaveCount(0);
  expect(mock.cardCountFor(workspaceId)).toBe(2);
  await expect(page.getByRole('button', { name: 'Edited study task', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare the study outline', exact: true })).toBeVisible();
});
