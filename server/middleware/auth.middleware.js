import { env } from "../config/env.js";
import { verifyAccessToken } from "../services/token.service.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import Admin from "../models/Admin.model.js";

/**
 * Protects protected routes by verifying the JWT access token
 * from either the Authorization header or the httpOnly cookie.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies[env.jwt.cookieName]) {
    token = req.cookies[env.jwt.cookieName];
  }

  if (!token) {
    throw ApiError.unauthorized("Not authorized - please log in.");
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized("Invalid or expired token.");
  }

  const admin = await Admin.findById(decoded.sub).select("+permissions");
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized("Account no longer active.");
  }

  if (admin.changedPasswordAfter(decoded.iat)) {
    throw ApiError.unauthorized("Password changed. Please log in again.");
  }

  req.admin = admin;
  next();
});

export default protect;