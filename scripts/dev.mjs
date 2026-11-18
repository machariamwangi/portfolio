import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { prepareAssets } from './prepare-assets.mjs';

await prepareAssets();
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (!args.includes('--port') && !args.includes('-p')) args.push('--port', process.env.PORT || '4173');
const next = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', ...args],
  { stdio: 'inherit' }
);

// Next handles React Fast Refresh. The editor also writes Markdown outside the module graph.
let timer;
let pending = Promise.resolve();
const watcher = watch('src/content', { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    pending = pending.then(prepareAssets).catch((error) => console.error(error.message));
  }, 200);
});
next.on('exit', (code) => {
  clearTimeout(timer);
  watcher.close();
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    if (!next.killed) next.kill(signal);
  });
}
