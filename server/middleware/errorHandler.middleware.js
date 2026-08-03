import mongoose from "mongoose";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

// 404 for unmatched routes
export const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errors = err.errors || null;

  // Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    error.statusCode = 400;
    error.message = "Validation failed";
    error.errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    error.statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    error.message = `Duplicate value for: ${field}`;
    error.errors = [{ field, message: `${field} already exists` }];
  }

  // Mongoose cast error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    error.statusCode = 400;
    error.message = `Invalid ${err.path}: ${err.value}`;
  }

  // Multer errors
  if (err.name === "MulterError") {
    error.statusCode = 400;
    error.message = err.message;
  }

  // JSON parse errors
  if (err.type === "entity.parse.failed") {
    error.statusCode = 400;
    error.message = "Invalid JSON payload";
  }

  if (!error.isOperational) {
    // Programmer/unknown error: log fully but keep response generic in prod
    const status = error.statusCode >= 500 ? error.statusCode : error.statusCode || 500;
    logger.error(
      { err: err.message, stack: err.stack, url: req.originalUrl, method: req.method },
      "Unhandled error"
    );
    error.statusCode = env.isProd && status >= 500 ? 500 : status;
    if (env.isProd && status >= 500) error.message = "Internal server error";
  } else {
    logger.error(`[${error.statusCode}] ${error.message}`);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message || "Something went wrong",
  };
  if (error.errors) response.errors = error.errors;

  return res.status(error.statusCode).json(response);
};