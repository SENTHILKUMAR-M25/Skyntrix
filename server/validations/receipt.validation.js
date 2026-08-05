import { body, param, query } from "express-validator";
import { RECEIPT_PAYMENT_METHODS } from "../models/Receipt.model.js";

export const receiptIdParam = [param("id").isMongoId().withMessage("Invalid receipt id")];

export const generateReceiptValidation = [
  body("invoiceId").isMongoId().withMessage("A valid invoice id is required"),
  body("paymentEntryId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid payment entry id"),
  body("method").optional({ values: "falsy" }).isIn(RECEIPT_PAYMENT_METHODS).withMessage("Invalid payment method"),
  body("reference").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Transaction id must be 200 characters or fewer"),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
  body("paidOn").optional({ values: "falsy" }).isISO8601().withMessage("Invalid payment date"),
];

export const resendReceiptValidation = [
  ...receiptIdParam,
  body("channel").optional({ values: "falsy" }).isIn(["whatsapp", "email", "both"]).withMessage("Invalid send channel"),
];

export const listReceiptsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be 1-200"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("invoiceId").optional().isMongoId().withMessage("Invalid invoice id"),
  query("quotationId").optional().isMongoId().withMessage("Invalid quotation id"),
  query("leadId").optional().isMongoId().withMessage("Invalid lead id"),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const receiptLogsQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
];
