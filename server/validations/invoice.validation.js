import { body, param, query } from "express-validator";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";
import { INVOICE_TYPES, PAYMENT_METHODS, INVOICE_DISCOUNT_TYPES } from "../models/Invoice.model.js";

const isMobile = (value) => Boolean(normalizeMobileNumber(value));

// clientName/projectName/mobile are required for a blank invoice, but may be
// omitted when creating "from a quotation" (the controller pre-fills them) or
// when sending/updating an existing record (values already stored).
const requiredUnlessPrefill = (value, req) => {
  if (req.body.quotationId || req.body.invoiceId) return true;
  return typeof value === "string" && value.trim().length > 0;
};

const itemsRule = body("items")
  .optional({ values: "falsy" })
  .isArray()
  .withMessage("Items must be a list")
  .bail()
  .custom((items) =>
    items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.trim().length <= 200
    )
  )
  .withMessage("Each item needs a name (max 200 characters)");

const commonFields = [
  body("leadId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid lead id"),
  body("clientName")
    .trim()
    .bail()
    .custom((value, { req }) => requiredUnlessPrefill(value, req))
    .withMessage("Client name is required")
    .bail()
    .isLength({ max: 200 })
    .withMessage("Client name must be 200 characters or fewer"),
  body("businessName").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Business name must be 200 characters or fewer"),
  body("mobile")
    .trim()
    .bail()
    .custom((value, { req }) => {
      if (req.body.quotationId || req.body.invoiceId) return true;
      return isMobile(value);
    })
    .withMessage("Enter a valid mobile number (with country code)"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").isLength({ max: 200 }).withMessage("Email must be 200 characters or fewer"),
  body("billingAddress").optional({ values: "falsy" }).trim().isLength({ max: 1000 }).withMessage("Billing address must be 1000 characters or fewer"),
  body("gstin").optional({ values: "falsy" }).trim().toUpperCase().isLength({ max: 20 }).withMessage("GSTIN must be 20 characters or fewer"),
  body("projectName")
    .trim()
    .bail()
    .custom((value, { req }) => requiredUnlessPrefill(value, req))
    .withMessage("Project name is required")
    .bail()
    .isLength({ max: 200 })
    .withMessage("Project name must be 200 characters or fewer"),
  body("projectDescription").optional({ values: "falsy" }).trim().isLength({ max: 5000 }).withMessage("Project description must be 5000 characters or fewer"),
  itemsRule,
  body("discount").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Discount must be a positive number"),
  body("discountType").optional({ values: "falsy" }).isIn(INVOICE_DISCOUNT_TYPES).withMessage("Invalid discount type"),
  body("taxRate").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  body("invoiceDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid invoice date"),
  body("dueDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid due date"),
  body("paymentMethod").optional({ values: "falsy" }).isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  body("type").optional({ values: "falsy" }).isIn(INVOICE_TYPES).withMessage("Invalid invoice type"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Notes must be 3000 characters or fewer"),
  body("terms").optional({ values: "falsy" }).trim().isLength({ max: 5000 }).withMessage("Terms must be 5000 characters or fewer"),
];

export const createInvoiceValidation = [
  ...commonFields,
  body("quotationId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid quotation id"),
];

export const updateInvoiceValidation = [
  ...commonFields,
  body("status").optional({ values: "falsy" }).isIn(["draft", "sent", "paid", "cancelled"]).withMessage("Invalid status"),
];

export const sendInvoiceValidation = [
  ...commonFields,
  body("invoiceId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid invoice id"),
  body("quotationId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid quotation id"),
  body("channel").optional({ values: "falsy" }).isIn(["whatsapp", "email", "both"]).withMessage("Invalid send channel"),
];

export const invoiceIdParam = [param("id").isMongoId().withMessage("Invalid invoice id")];

export const paymentValidation = [
  ...invoiceIdParam,
  body("amount").isFloat({ min: 0.01 }).withMessage("Payment amount must be a positive number"),
  body("method").optional({ values: "falsy" }).isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  body("reference").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Reference must be 200 characters or fewer"),
  body("paidOn").optional({ values: "falsy" }).isISO8601().withMessage("Invalid payment date"),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
];

export const markPaidValidation = [
  ...invoiceIdParam,
  body("method").optional({ values: "falsy" }).isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  body("reference").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Reference must be 200 characters or fewer"),
];

export const listInvoicesValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be 1-200"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("status").optional().isString(),
  query("paymentStatus").optional().isString(),
  query("type").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const invoiceLogsQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
];
