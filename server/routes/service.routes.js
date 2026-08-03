import { Router } from "express";
import {
  createService,
  updateService,
  deleteService,
  fetchPublicServices,
  fetchServiceBySlug,
  listServices,
  listServiceDetail,
  updateServiceStatus,
} from "../controllers/service.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadImage } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, serviceValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(fetchPublicServices));
router.get("/public/:slug", asyncHandler(fetchServiceBySlug));

// ADMIN (protected)
router.use("/admin", protect);
router.get("/admin", asyncHandler(listServices));
router.get("/admin/:id", idParam, asyncHandler(listServiceDetail));
router.post("/admin", uploadImage, validate(serviceValidation), asyncHandler(createService));
router.put("/admin/:id", uploadImage, asyncHandler(updateService));
router.put("/admin/:id/status", idParam, requirePermission("publish"), asyncHandler(updateServiceStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteService));

export default router;