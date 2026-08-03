import { Router } from "express";
import {
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  fetchPublicTestimonials,
  listTestimonials,
  listTestimonialDetail,
  updateTestimonialStatus,
} from "../controllers/testimonial.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadImage } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, testimonialValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(fetchPublicTestimonials));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listTestimonials));
router.get("/admin/:id", idParam, asyncHandler(listTestimonialDetail));
router.post("/admin", uploadImage, validate(testimonialValidation), asyncHandler(createTestimonial));
router.put("/admin/:id", uploadImage, asyncHandler(updateTestimonial));
router.put("/admin/:id/status", idParam, requirePermission("publish"), asyncHandler(updateTestimonialStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteTestimonial));

export default router;