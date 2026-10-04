import env from './src/config/env.js';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { startSlaScheduler, stopSlaScheduler } from './src/scheduler/slaScheduler.js';

const start = async () => {
  await connectDB();

  // Start background SLA monitoring & auto-escalation engine
  startSlaScheduler(60000);

  const server = app.listen(env.PORT, () => {
    console.log(`[server] BBDU Hosteller API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  server.on('error', (err) => {
    console.error(`[server] Failed to start: ${err.message}`);
    process.exit(1);
  });

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
  console.error('[process] Unhandled rejection:', reason);
  process.exit(1);
});

start().catch((err) => {
  console.error('[server] Startup error:', err.message);
  process.exit(1);
});
