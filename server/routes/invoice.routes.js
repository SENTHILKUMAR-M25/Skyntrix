import { Router } from "express";
import {
  createInvoice,
  listInvoices,
  getInvoice,
  getPublicInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  resendInvoice,
  downloadInvoice,
  recordInvoicePayment,
  markInvoicePaid,
  cancelInvoice,
  getInvoiceStats,
  getInvoicePrefill,
  listOverdueInvoices,
  sendOverdueReminders,
  getInvoiceSendLogs,
} from "../controllers/invoice.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createInvoiceValidation,
  updateInvoiceValidation,
  sendInvoiceValidation,
  paymentValidation,
  markPaidValidation,
  invoiceIdParam,
  listInvoicesValidation,
  invoiceLogsQuery,
} from "../validations/invoice.validation.js";

const router = Router();

// Public (no auth) share endpoint: the client invoice view page reads from
// here. Must be registered before the protect middleware below.
router.get("/share/:id", validate(invoiceIdParam), asyncHandler(getPublicInvoice));

// All invoice routes are admin-only (JWT protected).
router.use(protect);

// Static / action routes before the :id routes
router.get("/stats", asyncHandler(getInvoiceStats));
router.get("/prefill/:id", validate(invoiceIdParam), asyncHandler(getInvoicePrefill));
router.post("/send", validate(sendInvoiceValidation), asyncHandler(sendInvoice));
router.get("/overdue", asyncHandler(listOverdueInvoices));
router.post("/overdue/remind", asyncHandler(sendOverdueReminders));
router.post("/:id/resend", validate(sendInvoiceValidation), asyncHandler(resendInvoice));
router.post("/:id/payments", validate(paymentValidation), asyncHandler(recordInvoicePayment));
router.post("/:id/mark-paid", validate(markPaidValidation), asyncHandler(markInvoicePaid));
router.post("/:id/cancel", validate(invoiceIdParam), asyncHandler(cancelInvoice));
router.get("/:id/download", validate(invoiceIdParam), asyncHandler(downloadInvoice));
router.get("/:id/logs", validate([...invoiceIdParam, ...invoiceLogsQuery]), asyncHandler(getInvoiceSendLogs));

// CRUD
router.get("/", validate(listInvoicesValidation), asyncHandler(listInvoices));
router.post("/", validate(createInvoiceValidation), asyncHandler(createInvoice));
router.get("/:id", validate(invoiceIdParam), asyncHandler(getInvoice));
router.put("/:id", validate(updateInvoiceValidation), asyncHandler(updateInvoice));
router.delete("/:id", requirePermission("delete"), validate(invoiceIdParam), asyncHandler(deleteInvoice));

export default router;
