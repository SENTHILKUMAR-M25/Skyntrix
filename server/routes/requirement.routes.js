import { Router } from "express";
import {
  createRequirement,
  listRequirements,
  getRequirement,
  updateRequirement,
  updateRequirementStatus,
  deleteRequirement,
  listRequirementsByContact,
  listReadyRequirements,
  getRequirementStats,
} from "../controllers/requirement.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createRequirementValidation,
  updateRequirementValidation,
  requirementIdParam,
  requirementStatusValidation,
  listRequirementsValidation,
} from "../validations/requirement.validation.js";

const router = Router();

// All requirement routes are admin-only (JWT protected).
router.use(protect);

// Static / action routes before the :id routes
router.get("/ready", asyncHandler(listReadyRequirements));
router.get("/stats", asyncHandler(getRequirementStats));
router.get("/by-contact/:contactId", asyncHandler(listRequirementsByContact));
router.post("/", validate(createRequirementValidation), asyncHandler(createRequirement));
router.get("/", validate(listRequirementsValidation), asyncHandler(listRequirements));
router.get("/:id", validate(requirementIdParam), asyncHandler(getRequirement));
router.put("/:id", validate(updateRequirementValidation), asyncHandler(updateRequirement));
router.put("/:id/status", validate(requirementStatusValidation), asyncHandler(updateRequirementStatus));
router.delete("/:id", requirePermission("delete"), validate(requirementIdParam), asyncHandler(deleteRequirement));

export default router;
