import { Router } from "express";
import {
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  fetchPublicPortfolios,
  fetchPortfolioBySlug,
  listPortfolios,
  listPortfolioDetail,
  updatePortfolioStatus,
} from "../controllers/portfolio.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadPortfolioFiles } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, portfolioValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(fetchPublicPortfolios));
router.get("/public/:slug", asyncHandler(fetchPortfolioBySlug));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listPortfolios));
router.get("/admin/:id", idParam, asyncHandler(listPortfolioDetail));
router.post("/admin", uploadPortfolioFiles, validate(portfolioValidation), asyncHandler(createPortfolio));
router.put("/admin/:id", uploadPortfolioFiles, asyncHandler(updatePortfolio));
router.put("/admin/:id/status", idParam, requirePermission("publish"), asyncHandler(updatePortfolioStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deletePortfolio));

export default router;