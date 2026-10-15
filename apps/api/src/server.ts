import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initIo } from './realtime/io.js';
import { registerJobs } from './jobs/index.js';
const server = createServer(createApp());
initIo(server);
registerJobs();
server.listen(env.PORT, () => console.log(`StudySync API listening on ${env.PORT}`));
