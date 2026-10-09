import dotenv from 'dotenv';

// Load variables from backend/.env (if present) into process.env.
dotenv.config({ quiet: true });

/**
 * Centralised, read-only view of environment configuration.
 * No secrets are hard-coded here; non-secret defaults only.
 */
const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  // Pilot gating (DEC-020): only the literal string 'true' enables it. Default is off.
  PILOT_MODE: process.env.PILOT_MODE === 'true',
});

export default env;
