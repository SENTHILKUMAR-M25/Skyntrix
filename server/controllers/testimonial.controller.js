import Testimonial from "../models/Testimonial.model.js";
import createCrudController from "./crud.factory.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const base = createCrudController(Testimonial, {
  searchFields: ["clientName", "company", "designation"],
  defaultSort: { displayOrder: 1, createdAt: -1 },
  documentName: "Testimonial",
});

export const createTestimonial = asyncHandler(async (req, res) => {
  const body = req.body;
  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/testimonials" });
    body.image = img.url;
    body.imagePublicId = img.public_id;
  }
  const doc = await Testimonial.create(body);
  return ApiResponse.created(res, "Testimonial created", doc);
});

export const updateTestimonial = asyncHandler(async (req, res) => {
  const existing = await Testimonial.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Testimonial not found");
  const body = req.body;
  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/testimonials" });
    if (existing.imagePublicId) await deleteFile(existing.imagePublicId);
    body.image = img.url;
    body.imagePublicId = img.public_id;
  }
  existing.set(body);
  await existing.save();
  return ApiResponse.ok(res, "Testimonial updated", existing);
});

export const deleteTestimonial = asyncHandler(async (req, res) => {
  const existing = await Testimonial.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Testimonial not found");
  if (existing.imagePublicId) await deleteFile(existing.imagePublicId);
  await existing.deleteOne();
  return ApiResponse.ok(res, "Testimonial deleted");
});

export const fetchPublicTestimonials = base.listPublic;
export const listTestimonials = base.list;
export const listTestimonialDetail = base.detail;
export const updateTestimonialStatus = base.updateStatus;