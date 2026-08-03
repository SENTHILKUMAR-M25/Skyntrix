import { Router } from "express";
import {
  createBlog,
  updateBlog,
  deleteBlog,
  fetchPublicBlogs,
  fetchBlogBySlug,
  listBlogs,
  listBlogDetail,
  updateBlogStatus,
} from "../controllers/blog.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { uploadImage } from "../middleware/upload.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { idParam, blogValidation } from "../validations/crud.validation.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// PUBLIC
router.get("/", asyncHandler(fetchPublicBlogs));
router.get("/public/:slug", asyncHandler(fetchBlogBySlug));

// ADMIN
router.use("/admin", protect);
router.get("/admin", asyncHandler(listBlogs));
router.get("/admin/:id", idParam, asyncHandler(listBlogDetail));
router.post("/admin", uploadImage, validate(blogValidation), asyncHandler(createBlog));
router.put("/admin/:id", uploadImage, asyncHandler(updateBlog));
router.put("/admin/:id/status", idParam, requirePermission("publish"), asyncHandler(updateBlogStatus));
router.delete("/admin/:id", requirePermission("delete"), asyncHandler(deleteBlog));

export default router;