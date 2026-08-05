import { Router } from "express";
import {
  createLead,
  listLeads,
  getLead,
  updateLead,
  updateStatus,
  getPipelineBoard,
  getPipelineNotifications,
  getLeadOverview,
  addLeadReminder,
  updateLeadReminder,
  deleteLeadReminder,
  uploadLeadAttachment,
  deleteLeadAttachment,
  getLeadHistory,
  addLeadNote,
  updateHistoryNote,
  deleteHistoryNote,
  deleteLead,
} from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadLeadFile } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  idParam,
  historyIdParam,
  reminderIdParam,
  attachmentIdParam,
  leadStatusValidation,
  leadNoteValidation,
  reminderCreateValidation,
  reminderUpdateValidation,
  leadHistoryQuery,
  pipelineBoardQuery,
} from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.post("/", asyncHandler(createLead));

// ADMIN
router.use("/admin", protect);

// Pipeline (static routes before :id routes)
router.get("/admin/pipeline/board", validate(pipelineBoardQuery), asyncHandler(getPipelineBoard));
router.get("/admin/pipeline/notifications", asyncHandler(getPipelineNotifications));

router.get("/admin", asyncHandler(listLeads));
router.get("/admin/:id/history", idParam, validate(leadHistoryQuery), asyncHandler(getLeadHistory));
router.post("/admin/:id/history", idParam, validate(leadNoteValidation), requirePermission("update"), asyncHandler(addLeadNote));
router.put("/admin/history/:historyId", historyIdParam, validate(leadNoteValidation), requirePermission("update"), asyncHandler(updateHistoryNote));
router.delete("/admin/history/:historyId", historyIdParam, requirePermission("delete"), asyncHandler(deleteHistoryNote));

// Reminders
router.post("/admin/:id/reminders", idParam, validate(reminderCreateValidation), requirePermission("update"), asyncHandler(addLeadReminder));
router.put("/admin/:id/reminders/:reminderId", idParam, reminderIdParam, validate(reminderUpdateValidation), requirePermission("update"), asyncHandler(updateLeadReminder));
router.delete("/admin/:id/reminders/:reminderId", idParam, reminderIdParam, requirePermission("update"), asyncHandler(deleteLeadReminder));

// Attachments
router.post("/admin/:id/attachments", idParam, requirePermission("update"), uploadLeadFile, asyncHandler(uploadLeadAttachment));
router.delete("/admin/:id/attachments/:attachmentId", idParam, attachmentIdParam, requirePermission("delete"), asyncHandler(deleteLeadAttachment));

// Profile bundle
router.get("/admin/:id/overview", idParam, asyncHandler(getLeadOverview));

router.get("/admin/:id", idParam, asyncHandler(getLead));
router.put("/admin/:id", asyncHandler(updateLead));
router.put("/admin/:id/status", validate(leadStatusValidation), asyncHandler(updateStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteLead));

export default router;
