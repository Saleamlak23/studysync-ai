import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

export default function applyTestMigrations() {
  const testEnvPath = resolve(process.cwd(), '.env.test');
  const envPath = existsSync(testEnvPath) ? testEnvPath : resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  const repositoryRoot = resolve(process.cwd(), '../..');
  execFileSync(
    process.execPath,
    [
      resolve(repositoryRoot, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      resolve(repositoryRoot, 'prisma/schema.prisma'),
    ],
    { stdio: 'inherit', env: process.env },
  );
}
