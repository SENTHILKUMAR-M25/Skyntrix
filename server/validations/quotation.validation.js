import { body, param, query } from "express-validator";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";

const isMobile = (value) => Boolean(normalizeMobileNumber(value));

const servicesRule = (field = "services") =>
  body(field)
    .optional({ values: "falsy" })
    .isArray()
    .withMessage("Services must be a list")
    .bail()
    .custom((items) =>
      items.every(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof s.name === "string" &&
          s.name.trim().length > 0 &&
          s.name.trim().length <= 200
      )
    )
    .withMessage("Each service needs a name (max 200 characters)");

const commonFields = [
  body("leadId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid lead id"),
  body("clientName")
    .trim()
    .notEmpty()
    .withMessage("Client name is required")
    .isLength({ max: 200 })
    .withMessage("Client name must be 200 characters or fewer"),
  body("businessName").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Business name must be 200 characters or fewer"),
  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .custom(isMobile)
    .withMessage("Enter a valid mobile number (with country code)"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").isLength({ max: 200 }).withMessage("Email must be 200 characters or fewer"),
  body("projectName")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ max: 200 })
    .withMessage("Project name must be 200 characters or fewer"),
  body("projectDescription").optional({ values: "falsy" }).trim().isLength({ max: 5000 }).withMessage("Project description must be 5000 characters or fewer"),
  servicesRule(),
  body("projectTimeline").optional({ values: "falsy" }).trim().isLength({ max: 300 }).withMessage("Project timeline must be 300 characters or fewer"),
  body("paymentTerms").optional({ values: "falsy" }).trim().isLength({ max: 1000 }).withMessage("Payment terms must be 1000 characters or fewer"),
  body("advanceAmount").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Advance amount must be a positive number"),
  body("additionalNotes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Additional notes must be 3000 characters or fewer"),
  body("validUntil").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid validity date"),
];

// totalAmount is required only when there are no priced line items.
const totalAmountRule = body("totalAmount")
  .optional({ values: "falsy" })
  .custom((value, { req }) => {
    if (!value && Array.isArray(req.body.services) && req.body.services.length) return true;
    return value !== undefined && value !== null && value !== "" && Number(value) >= 0;
  })
  .withMessage("Total amount is required when no service line items are provided")
  .isFloat({ min: 0 })
  .withMessage("Total amount must be a positive number");

export const createQuotationValidation = [...commonFields, totalAmountRule];

export const updateQuotationValidation = [
  ...commonFields.map((chain) => chain),
  totalAmountRule,
  body("status").optional({ values: "falsy" }).isIn(["draft", "sent", "failed"]).withMessage("Invalid status"),
  body("whatsappStatus").optional({ values: "falsy" }).isIn(["pending", "sent", "failed"]).withMessage("Invalid WhatsApp status"),
];

export const sendQuotationValidation = [
  ...commonFields,
  totalAmountRule,
  body("quotationId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid quotation id"),
];

export const quotationIdParam = [param("id").isMongoId().withMessage("Invalid quotation id")];

export const approveQuotationValidation = [
  ...quotationIdParam,
  body("note").optional({ values: "falsy" }).isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
];

export const listQuotationsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be 1-200"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("status").optional().isString(),
  query("whatsappStatus").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const quotationLogsQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
];
