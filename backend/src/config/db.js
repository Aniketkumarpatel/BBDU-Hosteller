import mongoose from 'mongoose';
import dns from 'node:dns';
import env from './env.js';
import { initModels } from '../models/index.js';

// Fix querySrv ECONNREFUSED issues on Windows local networks resolving MongoDB Atlas SRV
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fallback silently if custom DNS setting is restricted
}

const READY_STATES = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

const URI_PATTERN = /^mongodb(\+srv)?:\/\//;

/** Remove credentials from anything that might contain a connection string. */
const redact = (text = '') => String(text).replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, '$1***:***@');

mongoose.set('strictQuery', true);

let listenersAttached = false;
const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  const { connection } = mongoose;
  connection.on('error', (err) => console.error(`[db] Connection error: ${redact(err.message)}`));
  connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
};

/**
 * Current database status for health checks. Never exposes the URI.
 * @returns {{ status: string, connected: boolean, name?: string }}
 */
export const getDbStatus = () => {
  const state = mongoose.connection.readyState;
  const connected = state === 1;
  return {
    status: READY_STATES[state] ?? 'unknown',
    connected,
    ...(connected ? { name: mongoose.connection.name } : {}),
  };
};

/**
 * Connect to MongoDB using MONGODB_URI.
 *
 *  - URI missing:      production -> throws; development -> warns and returns false
 *  - URI malformed:    always throws (configuration error)
 *  - Connect failure:  always throws (a configured-but-unreachable database
 *                      should stop startup instead of failing later)
 *  - On success it waits for all model indexes (unique constraints) to build.
 *
 * @param {string} [uri] defaults to env.MONGODB_URI
 * @returns {Promise<boolean>} true if connected, false if skipped (dev, no URI)
 */
export const connectDB = async (uri = env.MONGODB_URI) => {
  if (!uri) {
    const msg = 'MONGODB_URI is not set. Add it to backend/.env (see .env.example).';
    if (env.isProduction) throw new Error(msg);
    console.warn(`[db] ${msg}`);
    console.warn('[db] Starting WITHOUT a database connection (development only).');
    return false;
  }

  if (!URI_PATTERN.test(uri)) {
    throw new Error('MONGODB_URI is invalid: it must start with "mongodb://" or "mongodb+srv://".');
  }

  attachListeners();

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 15,
      minPoolSize: 2,
      autoIndex: !env.isProduction,
    });
    await initModels();
  } catch (err) {
    await mongoose.disconnect().catch(() => {});
    const hint = /auth/i.test(err.message)
      ? ' (check the username/password in MONGODB_URI)'
      : /ECONNREFUSED|ENOTFOUND|timed out|selection/i.test(err.message)
        ? ' (is MongoDB running / reachable and is the host correct?)'
        : '';
    throw new Error(`MongoDB connection failed: ${redact(err.message)}${hint}`);
  }

  const { host, name } = mongoose.connection;
  console.log(`[db] MongoDB connected: ${host}/${name}`);
  return true;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
