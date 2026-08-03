import logger from "./logger.js";

export class ApiError extends Error {
  constructor(statusCode, message, errors = [], isOperational = true, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.isOperational = isOperational;
    if (stack) this.stack = stack;
    else Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factory methods
ApiError.badRequest = (message = "Bad request", errors = []) =>
  new ApiError(400, message, errors);
ApiError.unauthorized = (message = "Unauthorized") =>
  new ApiError(401, message);
ApiError.forbidden = (message = "Forbidden") =>
  new ApiError(403, message);
ApiError.notFound = (message = "Resource not found") =>
  new ApiError(404, message);
ApiError.conflict = (message = "Conflict") =>
  new ApiError(409, message);
ApiError.tooMany = (message = "Too many requests") =>
  new ApiError(429, message);

export default ApiError;