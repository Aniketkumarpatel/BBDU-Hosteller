import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from './ApiError.js';

/**
 * Sign a JWT token containing only necessary non-sensitive claims: userId and role.
 * @param {object} payload
 * @param {string} payload.userId User's MongoDB _id as string
 * @param {string} payload.role User's system role
 * @returns {string} Signed JWT
 */
export const signToken = ({ userId, role }) => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in backend environment variables.');
  }

  return jwt.sign(
    { userId: String(userId), role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify a JWT token and return its decoded payload.
 * Throws ApiError.unauthorized on invalid or expired token.
 * @param {string} token
 * @returns {{ userId: string, role: string, iat: number, exp: number }}
 */
export const verifyToken = (token) => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in backend environment variables.');
  }

  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Authentication token has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token.');
  }
};
