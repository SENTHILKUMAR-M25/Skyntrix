import Portfolio from "../models/Portfolio.model.js";
import createCrudController from "./crud.factory.js";
import generateUniqueSlug from "./slug.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const base = createCrudController(Portfolio, {
  searchFields: ["title", "overview", "client", "industry", "category"],
  defaultSort: { displayOrder: 1, createdAt: -1 },
  documentName: "Portfolio",
});

// Private helper to convert arrays safely
const arr = (v) => {
  if (!v) return [];
  return Array.isArray(v) ? v : String(v).split(",").filter(Boolean);
};

export const createPortfolio = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.slug) body.slug = await generateUniqueSlug(Portfolio, body.title);

  body.technologies = arr(body.technologies);

  // Single thumbnail image (field name: 'image')
  if (req.files?.image?.[0]) {
    const img = await uploadFile(req.files.image[0], { folder: "skyntrix/portfolio" });
    body.thumbnail = img.url;
    body.thumbnailPublicId = img.public_id;
  }

  // Multiple gallery images (field name: 'images' via multer fields)
  const gallery = req.files?.images || [];
  const images = [];
  const imagePublicIds = [];
  for (const f of gallery) {
    const img = await uploadFile(f, { folder: "skyntrix/portfolio" });
    images.push(img.url);
    imagePublicIds.push(img.public_id);
  }
  if (images.length) {
    body.images = images;
    body.imagePublicIds = imagePublicIds;
  }

  const doc = await Portfolio.create(body);
  return ApiResponse.created(res, "Portfolio created", doc);
});

export const updatePortfolio = asyncHandler(async (req, res) => {
  const existing = await Portfolio.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Portfolio not found");

  const body = req.body;
  if (!body.slug || body.slug !== existing.slug) {
    body.slug = await generateUniqueSlug(Portfolio, body.title || existing.title, existing._id);
  }
  body.technologies = arr(body.technologies);

  if (req.files?.image?.[0]) {
    const img = await uploadFile(req.files.image[0], { folder: "skyntrix/portfolio" });
    if (existing.thumbnailPublicId) await deleteFile(existing.thumbnailPublicId);
    body.thumbnail = img.url;
    body.thumbnailPublicId = img.public_id;
  }

  const gallery = req.files?.images || [];
  if (gallery.length) {
    const images = [];
    const imagePublicIds = [];
    for (const f of gallery) {
      const img = await uploadFile(f, { folder: "skyntrix/portfolio" });
      images.push(img.url);
      imagePublicIds.push(img.public_id);
    }
    body.images = images;
    body.imagePublicIds = imagePublicIds;
  }

  existing.set(body);
  await existing.save();
  return ApiResponse.ok(res, "Portfolio updated", existing);
});

export const deletePortfolio = asyncHandler(async (req, res) => {
  const existing = await Portfolio.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Portfolio not found");
  if (existing.thumbnailPublicId) await deleteFile(existing.thumbnailPublicId);
  for (const pid of existing.imagePublicIds) await deleteFile(pid);
  await existing.deleteOne();
  return ApiResponse.ok(res, "Portfolio deleted");
});

export const fetchPublicPortfolios = base.listPublic;
export const fetchPortfolioBySlug = base.detailPublic;
export const listPortfolios = base.list;
export const listPortfolioDetail = base.detail;
export const updatePortfolioStatus = base.updateStatus;