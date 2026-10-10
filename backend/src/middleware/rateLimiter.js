import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';

const isTest = () => process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test';

/**
 * Sensitive Authentication Endpoints Rate Limiter
 * 20 attempts per 15-minute window in production; relaxed in development/test
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 20 : 500,
  skip: isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

/**
 * AI Query & Reasoning Endpoint Rate Limiter
 * 30 queries per 15-minute window per IP/user
 */
export const aiQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI intelligence queries. Please wait a few minutes before submitting more questions.',
  },
});

/**
 * High-Cost Analytics Aggregation Rate Limiter
 * 60 requests per 15-minute window
 */
export const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  skip: isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Analytics request limit reached. Please retry shortly.',
  },
});

/**
 * General API Denial-of-Service Limiter
 * 1000 requests per 15-minute window per IP
 */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  skip: (req) => isTest() || req.path === '/health' || req.originalUrl?.includes('/health'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down.',
  },
});
