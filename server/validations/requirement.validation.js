import { body, param, query } from "express-validator";
import { REQUIREMENT_PROJECT_TYPES, REQUIREMENT_PRIORITY, REQUIREMENT_STATUS } from "../models/Requirement.model.js";

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

const optionalText = (field, max, label) =>
  body(field)
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max })
    .withMessage(`${label || field} must be ${max} characters or fewer`);

const boolRule = (field) =>
  body(field).optional({ values: "falsy" }).isBoolean().withMessage(`${field} must be a boolean`);

const optionalNumber = (field, label) =>
  body(field)
    .optional({ values: "falsy" })
    .isFloat({ min: 0 })
    .withMessage(`${label || field} must be a positive number`);

const socialLinksRule = body("socialMediaLinks")
  .optional({ values: "falsy" })
  .isArray()
  .withMessage("Social media links must be a list")
  .custom((links) =>
    links.every((l) => {
      if (!l) return true;
      try {
        const parsed = new URL(String(l));
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    })
  )
  .withMessage("Each social media link must be a valid URL");

export const requirementFields = [
  body("contactId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid contact id"),
  body("leadId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid lead id"),

  body("businessName").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Business name must be 200 characters or fewer"),
  body("clientName").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Client name must be 200 characters or fewer"),
  body("mobileNumber").optional({ values: "falsy" }).trim().isLength({ max: 20 }).withMessage("Mobile number must be 20 characters or fewer"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").isLength({ max: 200 }).withMessage("Email must be 200 characters or fewer"),
  optionalText("location", 200, "Location"),
  optionalUrl("existingWebsite", "Existing website"),
  socialLinksRule,

  body("projectType")
    .optional({ values: "falsy" })
    .isIn(REQUIREMENT_PROJECT_TYPES)
    .withMessage("Invalid project type"),
  optionalText("projectName", 200, "Project name"),
  optionalText("businessDescription", 5000, "Business description"),
  optionalText("projectDescription", 5000, "Project description"),
  optionalText("mainObjective", 2000, "Main objective"),
  optionalText("targetAudience", 2000, "Target audience"),
  optionalText("requiredFeatures", 5000, "Required features"),
  optionalNumber("numberOfPages", "Number of pages"),
  optionalNumber("numberOfProducts", "Number of products"),
  boolRule("adminPanelRequired"),
  boolRule("paymentGatewayRequired"),
  boolRule("authenticationRequired"),
  boolRule("whatsappIntegration"),
  boolRule("emailIntegration"),
  optionalText("thirdPartyIntegrations", 2000, "Third-party integrations"),
  boolRule("hostingRequired"),
  boolRule("domainRequired"),
  boolRule("maintenanceRequired"),

  optionalText("preferredTechnology", 500, "Preferred technology"),
  optionalText("frontend", 500, "Frontend"),
  optionalText("backend", 500, "Backend"),
  optionalText("database", 500, "Database"),
  optionalText("apiRequirements", 2000, "API requirements"),
  optionalText("hostingDeploymentRequirements", 2000, "Hosting / deployment requirements"),
  optionalText("otherTechnicalRequirements", 2000, "Other technical requirements"),

  optionalNumber("clientBudget", "Client budget"),
  body("expectedStartDate").optional({ values: "falsy" }).isISO8601().withMessage("Invalid expected start date"),
  body("expectedDeliveryDate").optional({ values: "falsy" }).isISO8601().withMessage("Invalid expected delivery date"),
  body("priority").optional({ values: "falsy" }).isIn(REQUIREMENT_PRIORITY).withMessage("Invalid priority"),
  optionalNumber("estimatedDevelopmentCost", "Estimated development cost"),
  optionalNumber("estimatedMaintenanceCost", "Estimated maintenance cost"),

  optionalText("clientExpectations", 3000, "Client expectations"),
  optionalText("referenceWebsites", 3000, "Reference websites"),
  optionalText("competitorWebsites", 3000, "Competitor websites"),
  optionalText("designPreferences", 3000, "Design preferences"),
  optionalText("specialInstructions", 3000, "Special instructions"),
  optionalText("internalNotes", 3000, "Internal notes"),
];

export const createRequirementValidation = [
  ...requirementFields,
  body("status").optional({ values: "falsy" }).isIn(REQUIREMENT_STATUS).withMessage("Invalid requirement status"),
];

export const updateRequirementValidation = [
  ...requirementFields,
  body("status").optional({ values: "falsy" }).isIn(REQUIREMENT_STATUS).withMessage("Invalid requirement status"),
];

export const requirementIdParam = [param("id").isMongoId().withMessage("Invalid requirement id")];

export const requirementStatusValidation = [
  ...requirementIdParam,
  body("status").isIn(REQUIREMENT_STATUS).withMessage("Invalid requirement status"),
];

export const listRequirementsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be 1-200"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("status").optional().isString(),
  query("contactId").optional().isMongoId().withMessage("Invalid contact id"),
  query("priority").optional().isString(),
  query("projectType").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];
