import { Router } from "express";
import {
  createQuotation,
  listQuotations,
  getQuotation,
  updateQuotation,
  deleteQuotation,
  sendQuotation,
  resendQuotation,
  approveQuotation,
  downloadQuotation,
  getQuotationStats,
  getQuotationSendLogs,
} from "../controllers/quotation.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createQuotationValidation,
  updateQuotationValidation,
  sendQuotationValidation,
  approveQuotationValidation,
  quotationIdParam,
  listQuotationsValidation,
  quotationLogsQuery,
} from "../validations/quotation.validation.js";

const router = Router();

// All quotation routes are admin-only (JWT protected).
router.use(protect);

// Static / action routes before the :id routes
router.get("/stats", asyncHandler(getQuotationStats));
router.post("/send", validate(sendQuotationValidation), asyncHandler(sendQuotation));
router.post("/:id/resend", validate(quotationIdParam), asyncHandler(resendQuotation));
router.post("/:id/approve", validate(approveQuotationValidation), asyncHandler(approveQuotation));
router.get("/:id/download", validate(quotationIdParam), asyncHandler(downloadQuotation));
router.get("/:id/logs", validate([...quotationIdParam, ...quotationLogsQuery]), asyncHandler(getQuotationSendLogs));

// CRUD
router.get("/", validate(listQuotationsValidation), asyncHandler(listQuotations));
router.post("/", validate(createQuotationValidation), asyncHandler(createQuotation));
router.get("/:id", validate(quotationIdParam), asyncHandler(getQuotation));
router.put("/:id", validate(updateQuotationValidation), asyncHandler(updateQuotation));
router.delete("/:id", requirePermission("delete"), validate(quotationIdParam), asyncHandler(deleteQuotation));

export default router;
