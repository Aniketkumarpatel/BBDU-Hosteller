import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

/**
 * 404 handler - runs when no route matched.
 */
export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Normalise known third-party errors (Mongoose, JWT, body parser) into ApiError.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(400, 'Validation failed', details);
  }

  // Mongoose bad ObjectId / cast error
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return new ApiError(409, `Duplicate value for: ${fields.join(', ') || 'unique field'}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') return new ApiError(401, 'Invalid token');
  if (err.name === 'TokenExpiredError') return new ApiError(401, 'Token expired');

  // Malformed JSON body (express.json)
  if (err.type === 'entity.parse.failed') return new ApiError(400, 'Malformed JSON body');
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request body too large');

  return err;
};

/**
 * Centralised error handler. Must be registered last.
 * Response shape: { success: false, message, details?, stack? }
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  const error = normalizeError(err);
  const statusCode = error.statusCode || error.status || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error('[error]', err);
  }

  const body = {
    success: false,
    // Never leak internal error messages in production for 5xx errors.
    message: isServerError && env.isProduction ? 'Internal server error' : error.message || 'Internal server error',
  };

  if (error.details) body.details = error.details;
  if (!env.isProduction && isServerError) body.stack = err.stack;

  res.status(statusCode).json(body);
};
