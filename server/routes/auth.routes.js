import { Router } from "express";
import {
  login,
  refresh,
  me,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/permission.middleware.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  createAdminValidation,
} from "../validations/auth.validation.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Public auth
router.post("/login", authLimiter, validate(loginValidation), asyncHandler(login));
router.post("/refresh", authLimiter, asyncHandler(refresh));
router.post("/forgot-password", authLimiter, validate(forgotPasswordValidation), asyncHandler(forgotPassword));
router.post("/reset-password", authLimiter, validate(resetPasswordValidation), asyncHandler(resetPassword));

// Protected
router.get("/me", protect, asyncHandler(me));
router.post("/logout", protect, asyncHandler(logout));
router.post("/change-password", protect, validate(changePasswordValidation), asyncHandler(changePassword));

// Admin management (super-admin only)
router.use("/admins", protect, authorizeRoles("super-admin"));
router.get("/admins", asyncHandler(listAdmins));
router.post("/admins", validate(createAdminValidation), asyncHandler(createAdmin));
router.put("/admins/:id", asyncHandler(updateAdmin));
router.delete("/admins/:id", asyncHandler(deleteAdmin));

export default router;