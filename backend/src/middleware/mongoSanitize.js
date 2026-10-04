import ApiError from '../utils/ApiError.js';

/**
 * Checks whether an object contains any keys starting with '$' or containing '.'
 * which could be used for NoSQL operator injection in MongoDB queries.
 */
const containsProhibitedKeys = (obj) => {
  if (!obj || typeof obj !== 'object') return false;

  for (const key of Object.keys(obj)) {
    if (key.includes('$') || key.includes('.')) {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (containsProhibitedKeys(obj[key])) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Middleware: mongoSanitize
 * Detects and blocks NoSQL injection payloads in req.body, req.query, and req.params.
 * Rejects requests with 400 Bad Request if operator injection is detected.
 */
export const mongoSanitize = (req, _res, next) => {
  try {
    if (req.body && containsProhibitedKeys(req.body)) {
      return next(ApiError.badRequest('Prohibited operator detected in request body. NoSQL injection blocked.'));
    }

    if (req.query && containsProhibitedKeys(req.query)) {
      return next(ApiError.badRequest('Prohibited operator detected in query parameters. NoSQL injection blocked.'));
    }

    if (req.params && containsProhibitedKeys(req.params)) {
      return next(ApiError.badRequest('Prohibited operator detected in path parameters. NoSQL injection blocked.'));
    }

    next();
  } catch (err) {
    next(err);
  }
};

export default mongoSanitize;
