import { Router } from "express";
import {
  getPublicSettings,
  getSettings,
  updateSettings,
} from "../controllers/settings.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadSettingsFiles } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(getPublicSettings));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(getSettings));
router.put("/admin", uploadSettingsFiles, asyncHandler(updateSettings));

export default router;