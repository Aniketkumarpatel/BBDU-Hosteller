/**
 * Operational (expected) error carrying an HTTP status code.
 * Throw this from controllers/services; the central error handler formats it.
 */
export default class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Human readable message
   * @param {unknown} [details] Optional extra info (e.g. validation errors)
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }
}
