import { body } from "express-validator";

export const loginValidation = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
];

export const resetPasswordValidation = [
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("confirmPassword").custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
];

export const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
];

export const createAdminValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").optional().isIn(["super-admin", "admin", "editor", "content-manager"]).withMessage("Invalid role"),
];