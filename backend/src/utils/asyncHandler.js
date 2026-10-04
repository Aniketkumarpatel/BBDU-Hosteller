/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * central error handler. (Express 5 does this natively; this keeps handlers
 * explicit and portable.)
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
