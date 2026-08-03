import { Router } from "express";
import {
  createLead,
  listLeads,
  getLead,
  updateLead,
  updateStatus,
  getLeadHistory,
  addLeadNote,
  updateHistoryNote,
  deleteHistoryNote,
  deleteLead,
} from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  idParam,
  historyIdParam,
  leadStatusValidation,
  leadNoteValidation,
  leadHistoryQuery,
} from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.post("/", asyncHandler(createLead));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listLeads));
router.get("/admin/:id/history", idParam, validate(leadHistoryQuery), asyncHandler(getLeadHistory));
router.post("/admin/:id/history", idParam, validate(leadNoteValidation), requirePermission("update"), asyncHandler(addLeadNote));
router.put("/admin/history/:historyId", historyIdParam, validate(leadNoteValidation), requirePermission("update"), asyncHandler(updateHistoryNote));
router.delete("/admin/history/:historyId", historyIdParam, requirePermission("delete"), asyncHandler(deleteHistoryNote));
router.get("/admin/:id", idParam, asyncHandler(getLead));
router.put("/admin/:id", asyncHandler(updateLead));
router.put("/admin/:id/status", validate(leadStatusValidation), asyncHandler(updateStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteLead));

export default router;
