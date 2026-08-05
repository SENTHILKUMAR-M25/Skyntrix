import { body, param, query } from "express-validator";
import { LEAD_STATUS, LEAD_PRIORITY } from "../models/Lead.model.js";

const slugComposer = () => param("slug").trim().notEmpty().withMessage("Slug is required");
const idComposer = () => param("id").isMongoId().withMessage("Invalid id");

export const slugParam = slugComposer();
export const idParam = idComposer();

export const q = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
  query("sort").optional().isString(),
  query("search").optional().isString(),
  query("status").optional().isString(),
];

export const serviceValidation = [body("title").trim().notEmpty().withMessage("Title is required")];
export const portfolioValidation = [body("title").trim().notEmpty().withMessage("Title is required")];
export const blogValidation = [body("title").trim().notEmpty().withMessage("Title is required")];
export const teamValidation = [body("name").trim().notEmpty().withMessage("Name is required")];
export const testimonialValidation = [
  body("clientName").trim().notEmpty().withMessage("Client name is required"),
  body("review").trim().notEmpty().withMessage("Review is required"),
  body("rating").optional().isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5"),
];
export const careerStatusValidation = [
  body("status")
    .isIn(["new", "reviewed", "interviewed", "rejected", "hired", "archived"])
    .withMessage("Invalid status"),
];
export const leadStatusValidation = [
  body("status").isIn(LEAD_STATUS).withMessage("Invalid pipeline stage"),
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
  body("priority").optional({ values: "falsy" }).isIn(LEAD_PRIORITY).withMessage("Invalid priority"),
  body("assignedTo").optional({ values: "falsy" }).isMongoId().withMessage("Invalid assignee"),
  body("assignedToName").optional().isString().isLength({ max: 100 }).withMessage("Assignee name must be 100 characters or fewer"),
  body("dueDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid due date"),
  body("dealValue").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Deal value must be a positive number"),
  body("probability").optional({ values: "falsy" }).isInt({ min: 0, max: 100 }).withMessage("Probability must be 0-100"),
  body("closeReason").optional().isString().isLength({ max: 500 }).withMessage("Close reason must be 500 characters or fewer"),
];
export const leadNoteValidation = [
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
];
export const reminderCreateValidation = [
  body("title").trim().notEmpty().withMessage("Reminder title is required").isLength({ max: 200 }).withMessage("Title must be 200 characters or fewer"),
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
  body("dueAt").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid reminder date"),
];
export const reminderUpdateValidation = [
  body("title").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Title must be 200 characters or fewer"),
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
  body("dueAt").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid reminder date"),
  body("completed").optional().isBoolean().withMessage("Completed must be a boolean"),
];
export const pipelineBoardQuery = [
  query("search").optional().isString(),
  query("priority").optional().isString(),
  query("assignedTo").optional().isMongoId().withMessage("Invalid assignee"),
  query("overdue").optional().isString(),
];
export const leadHistoryQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
  query("status").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];
export const historyIdParam = param("historyId").isMongoId().withMessage("Invalid history id");
export const reminderIdParam = param("reminderId").isMongoId().withMessage("Invalid reminder id");
export const attachmentIdParam = param("attachmentId").isMongoId().withMessage("Invalid attachment id");
export const newsletterValidation = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
];