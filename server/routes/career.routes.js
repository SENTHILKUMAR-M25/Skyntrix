import { Router } from "express";
import {
  apply,
  listJobs,
  listApplications,
  getApplication,
  updateStatus,
  addNotes,
  deleteApp,
} from "../controllers/career.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadResume } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, careerStatusValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.post("/apply", uploadResume, asyncHandler(apply));
router.get("/jobs", asyncHandler(listJobs));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listApplications));
router.get("/admin/:id", idParam, asyncHandler(getApplication));
router.put("/admin/:id/status", validate(careerStatusValidation), asyncHandler(updateStatus));
router.put("/admin/:id/notes", asyncHandler(addNotes));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteApp));

export default router;