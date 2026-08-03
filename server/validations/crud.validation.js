import { body, param, query } from "express-validator";

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
  body("status").isIn(["new", "contacted", "converted", "closed"]).withMessage("Invalid status"),
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
];
export const leadNoteValidation = [
  body("note").optional().isString().isLength({ max: 1000 }).withMessage("Note must be 1000 characters or fewer"),
];
export const leadHistoryQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
  query("status").optional().isString(),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
];
export const historyIdParam = param("historyId").isMongoId().withMessage("Invalid history id");
export const newsletterValidation = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
];