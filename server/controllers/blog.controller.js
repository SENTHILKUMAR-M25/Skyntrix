import Blog from "../models/Blog.model.js";
import createCrudController from "./crud.factory.js";
import generateUniqueSlug from "./slug.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const base = createCrudController(Blog, {
  searchFields: ["title", "excerpt", "content", "category", "tags"],
  defaultSort: { publishedDate: -1, createdAt: -1 },
  documentName: "Blog",
});

const withThumbnail = async (req, body) => {
  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/blogs" });
    body.thumbnail = img.url;
    body.thumbnailPublicId = img.public_id;
    body.featuredImage = img.url;
    body.featuredImagePublicId = img.public_id;
  }
  return body;
};

export const createBlog = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.slug) body.slug = await generateUniqueSlug(Blog, body.title);
  if (body.status === "published" && !body.publishedDate) body.publishedDate = new Date();
  if (body.status === "scheduled" && !body.publishedDate && body.scheduledAt) body.publishedDate = body.scheduledAt;
  const enriched = await withThumbnail(req, body);
  const doc = await Blog.create(enriched);
  // Approximate read time from content
  if (doc.content) {
    const words = doc.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
    doc.readTime = `${Math.max(1, Math.round(words / 200))} min`;
    await doc.save();
  }
  return ApiResponse.created(res, "Blog created", doc);
});

export const updateBlog = asyncHandler(async (req, res) => {
  const existing = await Blog.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Blog not found");

  const body = req.body;
  if (!body.slug || body.slug !== existing.slug) {
    body.slug = await generateUniqueSlug(Blog, body.title || existing.title, existing._id);
  }
  if (body.status === "published" && !existing.publishedDate) body.publishedDate = new Date();
  if (body.status === "scheduled" && body.scheduledAt) body.publishedDate = body.scheduledAt;
  const enriched = await withThumbnail(req, body);
  if (req.file && existing.thumbnailPublicId) await deleteFile(existing.thumbnailPublicId);

  existing.set(enriched);
  await existing.save();

  if (existing.content) {
    const words = existing.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
    existing.readTime = `${Math.max(1, Math.round(words / 200))} min`;
    await existing.save();
  }
  return ApiResponse.ok(res, "Blog updated", existing);
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const existing = await Blog.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Blog not found");
  if (existing.thumbnailPublicId) await deleteFile(existing.thumbnailPublicId);
  await existing.deleteOne();
  return ApiResponse.ok(res, "Blog deleted");
});

// Increment view counter when a public post is fetched
export const fetchBlogBySlug = asyncHandler(async (req, res) => {
  const doc = await Blog.findOneAndUpdate(
    { slug: req.params.slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound("Blog post not found");
  return ApiResponse.ok(res, "Blog post fetched", doc);
});

export const fetchPublicBlogs = base.listPublic;
export const listBlogs = base.list;
export const listBlogDetail = base.detail;
export const updateBlogStatus = base.updateStatus;