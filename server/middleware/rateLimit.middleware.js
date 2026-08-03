import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many requests - please try again later.",
  },
});

// Stricter limiter for auth endpoints (login, forgot, etc.)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: "Too many auth attempts. Please try again after 15 minutes.",
    });
  },
});