import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Automatically launches the Express backend whenever the frontend dev server starts,
 * unless it is already running or managed by a parent orchestrator (dev.mjs).
 */
function autoBackendPlugin() {
  let backendProc = null;

  const killBackend = () => {
    if (backendProc && backendProc.pid) {
      const pid = backendProc.pid;
      backendProc = null;
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { stdio: 'ignore' });
        } else {
          process.kill(pid, 'SIGTERM');
        }
      } catch {}
    }
  };

  return {
    name: 'auto-backend-runner',
    configureServer(server) {
      if (process.env.DEV_MJS === 'true') {
        // Root dev orchestrator is already managing the backend process
        return;
      }

      let started = false;
      const startBackend = () => {
        if (started) return;
        started = true;

        console.log('\x1b[36m[backend]\x1b[0m Starting Express API server automatically on port 5000...');
        const backendDir = path.resolve(__dirname, '../backend');

        backendProc = spawn(process.execPath, ['--watch', 'server.js'], {
          cwd: backendDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        backendProc.stdout?.on('data', (d) => {
          const lines = d.toString().split('\n');
          lines.forEach((line) => {
            if (line.trim()) console.log(`\x1b[34m[backend]\x1b[0m ${line}`);
          });
        });

        backendProc.stderr?.on('data', (d) => {
          const lines = d.toString().split('\n');
          lines.forEach((line) => {
            if (line.trim()) console.error(`\x1b[31m[backend]\x1b[0m ${line}`);
          });
        });

        backendProc.on('error', (err) => {
          console.error('\x1b[31m[backend]\x1b[0m Failed to auto-start backend:', err.message);
        });

        backendProc.on('exit', (code) => {
          if (code && code !== 0) {
            console.warn(`\x1b[33m[backend]\x1b[0m Backend stopped (exit code ${code}).`);
          }
        });
      };

      const timer = setTimeout(() => {
        checkReq.destroy();
        startBackend();
      }, 1500);

      // Check if backend is already listening on port 5000
      const checkReq = http.get('http://127.0.0.1:5000/api/health', (res) => {
        clearTimeout(timer);
        console.log('\x1b[32m[backend]\x1b[0m Express API server is already running on http://127.0.0.1:5000');
        res.resume();
      });

      checkReq.on('error', () => {
        clearTimeout(timer);
        startBackend();
      });

      // Ensure backend process terminates when Vite exits
      process.on('exit', killBackend);
      process.on('SIGINT', () => {
        killBackend();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        killBackend();
        process.exit(0);
      });
      server.httpServer?.on('close', killBackend);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), autoBackendPlugin()],
  server: {
    host: true,
    port: 5173,
    // Proxy API calls to Express backend during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (err.code === 'ECONNREFUSED' && res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend is starting up, please wait...' }));
            }
          });
        },
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

