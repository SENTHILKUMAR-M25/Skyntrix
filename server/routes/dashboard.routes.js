import { Router } from "express";
import {
  getOverview,
  getCharts,
  getRecentActivity,
} from "../controllers/dashboard.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);

router.get("/overview", asyncHandler(getOverview));
router.get("/charts", requirePermission("get"), asyncHandler(getCharts));
router.get("/activity", requirePermission("get"), asyncHandler(getRecentActivity));

export default router;