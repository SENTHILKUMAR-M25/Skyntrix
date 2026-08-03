import { Router } from "express";
import {
  subscribe,
  listSubscribers,
  deleteSubscriber,
  exportCsv,
} from "../controllers/newsletter.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { newsletterValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.post("/", validate(newsletterValidation), asyncHandler(subscribe));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listSubscribers));
router.get("/admin/export", asyncHandler(exportCsv));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteSubscriber));

export default router;