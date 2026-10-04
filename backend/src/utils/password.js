import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} password Plain text password
 * @returns {Promise<string>} Salted bcrypt hash
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a plain-text password with a bcrypt hash.
 * @param {string} password Plain text candidate password
 * @param {string} hash Stored bcrypt hash
 * @returns {Promise<boolean>} True if matching
 */
export const comparePassword = async (password, hash) => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};
