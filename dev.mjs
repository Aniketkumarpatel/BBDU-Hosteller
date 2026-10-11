import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   Starting BBDU-Hosteller Fullstack Environment   ');
console.log('\x1b[36m%s\x1b[0m', '==================================================');

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'pipe',
  shell: isWin,
  env: { ...process.env, DEV_MJS: 'true' },
});

const frontend = spawn(npmCmd, ['run', 'dev:ui'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'pipe',
  shell: isWin,
  env: { ...process.env, DEV_MJS: 'true' },
});

const pipeOutput = (proc, prefix, colorCode) => {
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${colorCode}${prefix}\x1b[0m ${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.error(`${colorCode}${prefix} [ERR]\x1b[0m ${line}`);
      }
    });
  });
};

pipeOutput(backend, '[BACKEND]', '\x1b[34m');
pipeOutput(frontend, '[FRONTEND]', '\x1b[32m');

const killTree = (proc) => {
  if (!proc || !proc.pid) return;
  try {
    if (isWin) {
      spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {}
};

const cleanup = () => {
  console.log('\n\x1b[33mStopping all services...\x1b[0m');
  killTree(backend);
  killTree(frontend);
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
