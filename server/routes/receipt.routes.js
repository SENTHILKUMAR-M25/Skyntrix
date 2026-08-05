import { Router } from "express";
import {
  generateReceipt,
  listReceipts,
  getReceipt,
  listReceiptHistory,
  getReceiptStats,
  downloadReceipt,
  regenerateReceipt,
  resendReceipt,
  getReceiptSendLogs,
} from "../controllers/receipt.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateReceiptValidation,
  resendReceiptValidation,
  receiptIdParam,
  listReceiptsValidation,
  receiptLogsQuery,
} from "../validations/receipt.validation.js";

const router = Router();

// All receipt routes are admin-only (JWT protected).
router.use(protect);

// Static / action routes before the :id routes
router.get("/stats", asyncHandler(getReceiptStats));
router.get("/history", asyncHandler(listReceiptHistory));
router.post("/generate", validate(generateReceiptValidation), asyncHandler(generateReceipt));
router.post("/:id/regenerate", validate(receiptIdParam), asyncHandler(regenerateReceipt));
router.post("/:id/resend", validate(resendReceiptValidation), asyncHandler(resendReceipt));
router.get("/:id/download", validate(receiptIdParam), asyncHandler(downloadReceipt));
router.get("/:id/logs", validate([...receiptIdParam, ...receiptLogsQuery]), asyncHandler(getReceiptSendLogs));

// CRUD
router.get("/", validate(listReceiptsValidation), asyncHandler(listReceipts));
router.get("/:id", validate(receiptIdParam), asyncHandler(getReceipt));

export default router;
