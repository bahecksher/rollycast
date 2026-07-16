import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'dev', '--workspace', 'apps/worker'], { stdio: 'inherit', shell: true }),
  spawn(npm, ['run', 'dev', '--workspace', 'apps/web'], { stdio: 'inherit', shell: true }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0 && signal === null) stop(code ?? 1);
  });
  child.on('error', () => stop(1));
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
