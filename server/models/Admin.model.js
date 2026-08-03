import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  EDITOR: "editor",
  CONTENT_MANAGER: "content-manager",
};

export const ROLE_LIST = Object.values(ROLES);

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLE_LIST, default: ROLES.ADMIN },
    permissions: {
      create: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false },
      publish: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: "" },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
    lastLoginIp: { type: String },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    passwordChangedAt: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before save
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

adminSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return jwtTimestamp < changedAt;
  }
  return false;
};

// Helper to map role -> default permission presets
export const rolePermissions = (role) => {
  const base = { viewAnalytics: false, publish: false };
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return { ...base, create: true, update: true, delete: true, publish: true, viewAnalytics: true };
    case ROLES.ADMIN:
      return { ...base, create: true, update: true, delete: true, publish: true, viewAnalytics: true };
    case ROLES.EDITOR:
      return { ...base, create: true, update: true, delete: false, publish: true, viewAnalytics: true };
    case ROLES.CONTENT_MANAGER:
      return { ...base, create: true, update: true, delete: false, publish: false, viewAnalytics: false };
    default:
      return { ...base, create: true, update: true };
  }
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;