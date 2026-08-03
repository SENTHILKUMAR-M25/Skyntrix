import Service from "../models/Service.model.js";
import createCrudController from "./crud.factory.js";
import generateUniqueSlug from "./slug.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const base = createCrudController(Service, {
  searchFields: ["title", "short", "overview"],
  defaultSort: { displayOrder: 1, createdAt: -1 },
  documentName: "Service",
});

export const createService = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.slug) body.slug = await generateUniqueSlug(Service, body.title);
  body.icon = body.icon || "globe";

  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/services" });
    body.heroImage = img.url;
    body.heroImagePublicId = img.public_id;
  }

  const doc = await Service.create(body);
  return ApiResponse.created(res, "Service created", doc);
});

export const updateService = asyncHandler(async (req, res) => {
  const existing = await Service.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Service not found");

  const body = req.body;
  if (!body.slug || body.slug !== existing.slug) {
    body.slug = await generateUniqueSlug(Service, body.title || existing.title, existing._id);
  }

  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/services" });
    if (existing.heroImagePublicId) await deleteFile(existing.heroImagePublicId);
    body.heroImage = img.url;
    body.heroImagePublicId = img.public_id;
  }

  existing.set(body);
  await existing.save();
  return ApiResponse.ok(res, "Service updated", existing);
});

export const deleteService = asyncHandler(async (req, res) => {
  const existing = await Service.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Service not found");
  if (existing.heroImagePublicId) await deleteFile(existing.heroImagePublicId);
  await existing.deleteOne();
  return ApiResponse.ok(res, "Service deleted");
});

// Public
export const fetchPublicServices = base.listPublic;
export const fetchServiceBySlug = base.detailPublic;
// Admin
export const listServices = base.list;
export const listServiceDetail = base.detail;
export const updateServiceStatus = base.updateStatus;