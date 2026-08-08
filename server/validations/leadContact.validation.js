import { body, param, query } from "express-validator";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";

const isMobile = (value) => Boolean(normalizeMobileNumber(value));

const optionalUrl = (field, label) =>
  body(field)
    .optional({ values: "falsy" })
    .trim()
    .custom((value) => {
      if (!value) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        throw new Error(`${label} must be a valid URL (include https://)`);
      }
    });

const tagsRule = (field = "tags") =>
  body(field)
    .optional({ values: "falsy" })
    .isArray()
    .withMessage("Tags must be a list")
    .custom((tags) => tags.every((t) => typeof t === "string" && t.trim().length <= 40))
    .withMessage("Each tag must be a short string")
    .customSanitizer((tags) => tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean));

const contactFields = [
  body("businessName")
    .trim()
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ max: 200 })
    .withMessage("Business name must be 200 characters or fewer"),
  body("mobileNumber")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .custom(isMobile)
    .withMessage("Enter a valid mobile number (10-digit Indian number or +91 format)"),
  body("summary")
    .trim()
    .notEmpty()
    .withMessage("Summary is required")
    .isLength({ max: 2000 })
    .withMessage("Summary must be 2000 characters or fewer"),
  optionalUrl("demoLink", "Demo link"),
  optionalUrl("websiteLink", "Website link"),
];

export const leadContactCreateValidation = [
  ...contactFields,
  body("contactPerson").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Contact person must be 200 characters or fewer"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").isLength({ max: 200 }).withMessage("Email must be 200 characters or fewer"),
  body("location").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Location must be 200 characters or fewer"),
  body("source").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Source must be 200 characters or fewer"),
  body("contactDate").optional({ values: "falsy" }).isISO8601().withMessage("Invalid contact date"),
  body("contactChannel")
    .optional({ values: "falsy" })
    .isIn(["call", "whatsapp", "email", "other"])
    .withMessage("Invalid contact channel"),
  body("contactNotes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Contact notes must be 3000 characters or fewer"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Notes must be 3000 characters or fewer"),
  tagsRule(),
  body("followUpStatus")
    .optional({ values: "falsy" })
    .isIn(["none", "follow-up", "converted", "closed"])
    .withMessage("Invalid follow-up status"),
  body("nextFollowUpAt").optional({ values: "falsy" }).isISO8601().withMessage("Invalid follow-up date"),
  body("assignedTo").optional({ values: "falsy" }).isMongoId().withMessage("Invalid assigned employee"),
];

export const leadContactUpdateValidation = [
  body("businessName").optional({ values: "falsy" }).trim().notEmpty().withMessage("Business name cannot be empty").isLength({ max: 200 }).withMessage("Business name must be 200 characters or fewer"),
  body("mobileNumber").optional({ values: "falsy" }).trim().custom(isMobile).withMessage("Enter a valid mobile number"),
  body("summary").optional({ values: "falsy" }).trim().notEmpty().withMessage("Summary cannot be empty").isLength({ max: 2000 }).withMessage("Summary must be 2000 characters or fewer"),
  optionalUrl("demoLink", "Demo link"),
  optionalUrl("websiteLink", "Website link"),
  body("status").optional({ values: "falsy" }).isIn(["draft", "sent", "failed"]).withMessage("Invalid status"),
  body("whatsappStatus").optional({ values: "falsy" }).isIn(["pending", "sent", "failed"]).withMessage("Invalid WhatsApp status"),
  body("contactPerson").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Contact person must be 200 characters or fewer"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").isLength({ max: 200 }).withMessage("Email must be 200 characters or fewer"),
  body("location").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Location must be 200 characters or fewer"),
  body("source").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Source must be 200 characters or fewer"),
  body("contactDate").optional({ values: "falsy" }).isISO8601().withMessage("Invalid contact date"),
  body("contactChannel")
    .optional({ values: "falsy" })
    .isIn(["call", "whatsapp", "email", "other"])
    .withMessage("Invalid contact channel"),
  body("contactNotes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Contact notes must be 3000 characters or fewer"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 3000 }).withMessage("Notes must be 3000 characters or fewer"),
  tagsRule(),
  body("followUpStatus").optional({ values: "falsy" }).isIn(["none", "follow-up", "converted", "closed"]).withMessage("Invalid follow-up status"),
  body("nextFollowUpAt").optional({ values: "falsy" }).isISO8601().withMessage("Invalid follow-up date"),
  body("assignedTo").optional({ values: "falsy" }).isMongoId().withMessage("Invalid assigned employee"),
];

export const sendWhatsAppValidation = [
  ...contactFields,
  body("leadId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid lead id"),
];

export const resendWhatsAppValidation = [param("id").isMongoId().withMessage("Invalid id")];

export const bulkSendValidation = [
  body("ids").isArray({ min: 1 }).withMessage("Select at least one lead").bail(),
  body("ids.*").isMongoId().withMessage("Invalid lead id in selection"),
];

export const bulkDeleteValidation = [
  body("ids").isArray({ min: 1 }).withMessage("Select at least one lead").bail(),
  body("ids.*").isMongoId().withMessage("Invalid lead id in selection"),
];

export const leadContactIdParam = [param("id").isMongoId().withMessage("Invalid id")];

export const leadContactQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be 1-200"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("status").optional().isString(),
  query("whatsappStatus").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const leadContactHistoryQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
  query("action").optional().isString(),
];
