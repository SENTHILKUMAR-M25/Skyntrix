import { Router } from "express";
import {
  createLeadContact,
  listLeadContacts,
  getLeadContact,
  updateLeadContact,
  deleteLeadContact,
  sendWhatsApp,
  resendWhatsApp,
  bulkSendWhatsApp,
  bulkDeleteLeadContacts,
  importLeadContacts,
  getLeadContactStats,
  getSentHistory,
  getLeadContactHistory,
  getContactPipelineBoard,
  previewWhatsApp,
  convertContactLead,
} from "../controllers/leadContact.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  leadContactCreateValidation,
  leadContactUpdateValidation,
  sendWhatsAppValidation,
  resendWhatsAppValidation,
  bulkSendValidation,
  bulkDeleteValidation,
  leadContactIdParam,
  leadContactQuery,
  leadContactHistoryQuery,
} from "../validations/leadContact.validation.js";

const router = Router();

// All Lead Contact routes are admin-only (JWT protected).
router.use(protect);

// Preview / statistics / history before the :id route
router.get("/stats", asyncHandler(getLeadContactStats));
router.get("/history", asyncHandler(getSentHistory));
router.get("/pipeline-board", asyncHandler(getContactPipelineBoard));
router.post("/preview", validate(sendWhatsAppValidation), asyncHandler(previewWhatsApp));
router.post("/send-whatsapp", validate(sendWhatsAppValidation), asyncHandler(sendWhatsApp));
router.post("/resend/:id", validate(resendWhatsAppValidation), asyncHandler(resendWhatsApp));
router.post("/bulk-send", validate(bulkSendValidation), asyncHandler(bulkSendWhatsApp));
router.post("/bulk-delete", validate(bulkDeleteValidation), asyncHandler(bulkDeleteLeadContacts));
router.post("/import", asyncHandler(importLeadContacts));
router.post("/convert/:leadId", asyncHandler(convertContactLead));

// CRUD
router.get("/", validate(leadContactQuery), asyncHandler(listLeadContacts));
router.post("/", validate(leadContactCreateValidation), asyncHandler(createLeadContact));
router.get("/:id/history", validate(leadContactHistoryQuery), asyncHandler(getLeadContactHistory));
router.get("/:id", validate(leadContactIdParam), asyncHandler(getLeadContact));
router.put("/:id", validate(leadContactUpdateValidation), asyncHandler(updateLeadContact));
router.delete("/:id", requirePermission("delete"), validate(leadContactIdParam), asyncHandler(deleteLeadContact));

export default router;
