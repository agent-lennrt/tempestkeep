import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', 'documentation screenshots'], {
  stdio: 'inherit', env: { ...process.env, CAPTURE_SCREENSHOTS: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
