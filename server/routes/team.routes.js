import { Router } from "express";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  fetchPublicTeam,
  listTeam,
  listTeamDetail,
} from "../controllers/team.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadImage } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, teamValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(fetchPublicTeam));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listTeam));
router.get("/admin/:id", idParam, asyncHandler(listTeamDetail));
router.post("/admin", uploadImage, validate(teamValidation), asyncHandler(createTeam));
router.put("/admin/:id", uploadImage, asyncHandler(updateTeam));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteTeam));

export default router;