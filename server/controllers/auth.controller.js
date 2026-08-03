import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import Admin, { rolePermissions, ROLES, ROLE_LIST } from "../models/Admin.model.js";
import AuditLog from "../models/AuditLog.model.js";
import { env } from "../config/env.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "../services/token.service.js";
import {
  sendResetPassword,
  sendMail,
} from "../services/mailer.service.js";
import crypto from "crypto";
import logger from "../utils/logger.js";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(env.jwt.cookieName, accessToken, accessCookieOptions());
  res.cookie(env.jwt.refreshCookieName, refreshToken, refreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie(env.jwt.cookieName, { path: "/" });
  res.clearCookie(env.jwt.refreshCookieName, { path: "/api/auth" });
};

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select("+password +refreshToken +permissions");
  if (!admin) {
    await AuditLog.create({ action: "failed_login", adminEmail: email, ip: req.ip, description: "No account found" });
    throw ApiError.unauthorized("Invalid credentials.");
  }

  if (admin.isLocked()) {
    throw ApiError.unauthorized("Account temporarily locked. Try again later.");
  }

  const valid = await admin.comparePassword(password);
  if (!valid) {
    admin.failedLoginAttempts += 1;
    if (admin.failedLoginAttempts >= MAX_ATTEMPTS) {
      admin.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      admin.failedLoginAttempts = 0;
    }
    await admin.save({ validateBeforeSave: false });
    await AuditLog.create({ action: "failed_login", adminEmail: email, ip: req.ip });
    logger.warn(`Failed login for ${email} (attempt ${admin.failedLoginAttempts})`);
    throw ApiError.unauthorized("Invalid credentials.");
  }

  // success
  admin.failedLoginAttempts = 0;
  admin.lockedUntil = null;
  admin.lastLogin = new Date();
  admin.lastLoginIp = req.ip;

  const accessToken = generateAccessToken(admin._id, admin.role);
  const refreshToken = generateRefreshToken(admin._id);
  admin.refreshToken = refreshToken;
  await admin.save({ validateBeforeSave: false });

  setAuthCookies(res, accessToken, refreshToken);
  await AuditLog.create({ action: "login", adminEmail: admin.email, ip: req.ip });

  // clean up
  delete admin._doc.password;
  delete admin._doc.refreshToken;

  return ApiResponse.ok(res, "Login successful", {
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions, avatar: admin.avatar },
    accessToken,
  });
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.body.refreshToken || req.cookies?.[env.jwt.refreshCookieName];

  if (!refreshToken) throw ApiError.unauthorized("Refresh token missing.");

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized("Invalid refresh token.");
  }

  const admin = await Admin.findById(decoded.sub).select("+refreshToken");
  if (!admin || admin.refreshToken !== refreshToken) {
    throw ApiError.unauthorized("Invalid refresh token.");
  }

  const newAccess = generateAccessToken(admin._id, admin.role);
  const newRefresh = generateRefreshToken(admin._id);
  admin.refreshToken = newRefresh;
  await admin.save({ validateBeforeSave: false });

  setAuthCookies(res, newAccess, newRefresh);
  return ApiResponse.ok(res, "Tokens refreshed", { accessToken: newAccess, refreshToken: newRefresh });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select("-password -refreshToken");
  return ApiResponse.ok(res, "Profile fetched", admin);
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.[env.jwt.refreshCookieName];
  if (refreshToken) {
    const admin = await Admin.findOne({ refreshToken });
    if (admin) {
      admin.refreshToken = undefined;
      await admin.save({ validateBeforeSave: false });
    }
  }
  logoutLog(req);
  clearAuthCookies(res);
  return ApiResponse.ok(res, "Logged out successfully");
});

async function logoutLog(req) {
  try {
    await AuditLog.create({ action: "logout", adminEmail: req.admin?.email, ip: req.ip });
  } catch (e) {}
}

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const admin = await Admin.findOne({ email }).select("+resetPasswordToken +resetPasswordExpires");
  if (!admin) {
    // Don't reveal; always return success
    return ApiResponse.ok(res, "If that email exists, a reset link has been sent.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  admin.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  admin.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  await admin.save({ validateBeforeSave: false });

  const resetUrl = `${env.appUrl}/admin/reset-password?token=${token}`;
  await sendResetPassword(admin.email, resetUrl);
  await AuditLog.create({ action: "forgot_password", adminEmail: admin.email, ip: req.ip });

  return ApiResponse.ok(res, "If that email exists, a reset link has been sent.");
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const admin = await Admin.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!admin) throw ApiError.badRequest("Invalid or expired reset token.");

  admin.password = password;
  admin.resetPasswordToken = undefined;
  admin.resetPasswordExpires = undefined;
  admin.refreshToken = undefined;
  await admin.save();

  await AuditLog.create({ action: "reset_password", adminEmail: admin.email });

  return ApiResponse.ok(res, "Password reset successful. Please log in.");
});

// POST /api/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin._id).select("+password +refreshToken");
  if (!admin) throw ApiError.unauthorized();

  const ok = await admin.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest("Current password is incorrect.");

  admin.password = newPassword;
  admin.refreshToken = undefined;
  await admin.save();

  await AuditLog.create({ action: "change_password", adminEmail: admin.email });

  clearAuthCookies(res);
  return ApiResponse.ok(res, "Password changed. Please log in again.");
});

// --- Admin management (super-admin only) ---
export const listAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find().select("-refreshToken -passwordChangedAt").sort("createdAt");
  return ApiResponse.ok(res, "Admins fetched", admins);
});

export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role = ROLES.ADMIN, permissions } = req.body;
  if (!ROLE_LIST.includes(role)) throw ApiError.badRequest("Invalid role");

  const existing = await Admin.findOne({ email });
  if (existing) throw ApiError.conflict("Admin with this email already exists");

  const admin = await Admin.create({
    name,
    email,
    password,
    role,
    permissions: permissions || rolePermissions(role),
  });

  await AuditLog.create({ action: "create_admin", adminEmail: admin.email });

  return ApiResponse.created(res, "Admin created", {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
  });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) throw ApiError.notFound("Admin not found");
  const { name, role, permissions, isActive } = req.body;
  if (name) admin.name = name;
  if (role && ROLE_LIST.includes(role)) {
    admin.role = role;
    admin.permissions = permissions || rolePermissions(role);
  } else if (permissions) {
    admin.permissions = { ...admin.permissions, ...permissions };
  }
  if (typeof isActive === "boolean") admin.isActive = isActive;
  await admin.save();
  await AuditLog.create({ action: "update_admin", adminEmail: req.admin.email });
  return ApiResponse.ok(res, "Admin updated", admin);
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) throw ApiError.notFound("Admin not found");
  if (admin.role === ROLES.SUPER_ADMIN && admin.email === env.seed.email) {
    throw ApiError.forbidden("Cannot delete the primary super-admin account.");
  }
  await admin.deleteOne();
  await AuditLog.create({ action: "delete_admin", adminEmail: req.admin.email });
  return ApiResponse.ok(res, "Admin deleted");
});