import cron from 'node-cron';
import { runReminders } from './reminders.js';
import { purgeArchived } from './purgeArchived.js';

const REMINDER_SCHEDULE = '*/15 * * * *';
const PURGE_SCHEDULE = '0 3 * * *';

function scheduleJob(name: string, expression: string, job: () => Promise<void>): void {
  cron.schedule(expression, () => {
    void job().catch((error: unknown) => console.error(`${name} job failed`, error));
  });
}

export function registerJobs(): void {
  scheduleJob('Reminder', REMINDER_SCHEDULE, runReminders);
  scheduleJob('Archived workspace purge', PURGE_SCHEDULE, purgeArchived);
}
