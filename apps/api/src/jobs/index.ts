import cron from 'node-cron';
import { runReminders } from './reminders.js';
import { purgeArchived } from './purgeArchived.js';
export function registerJobs(): void { cron.schedule('*/15 * * * *', runReminders); cron.schedule('0 0 * * *', purgeArchived); }
