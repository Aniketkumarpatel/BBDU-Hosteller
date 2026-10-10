import env from './src/config/env.js';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { startSlaScheduler, stopSlaScheduler } from './src/scheduler/slaScheduler.js';

const start = async () => {
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[server] BBDU Hosteller API listening on http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
  });

  server.on('error', (err) => {
    console.error(`[server] Failed to start: ${err.message}`);
    process.exit(1);
  });

  // Connect to database with graceful retry in development
  const connectWithRetry = async (attempt = 1) => {
    try {
      const connected = await connectDB();
      if (connected) {
        startSlaScheduler(60000);
      }
    } catch (err) {
      console.error(`[server] Database connection attempt ${attempt} failed: ${err.message}`);
      if (!env.isProduction) {
        console.warn('[server] Will retry database connection in 5 seconds...');
        setTimeout(() => connectWithRetry(attempt + 1), 5000);
      } else {
        process.exit(1);
      }
    }
  };

  await connectWithRetry();

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down...`);
    stopSlaScheduler();
    server.close(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

process.on('unhandledRejection', (reason) => {
  console.error('[process] Warning (unhandled rejection):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[process] Critical uncaught exception:', err);
});

start().catch((err) => {
  console.error('[server] Startup error:', err.message);
  process.exit(1);
});
