import Career from "../models/Career.model.js";
import createCrudController from "./crud.factory.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";
import { sendCareerNotification } from "../services/mailer.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

const base = createCrudController(Career, {
  searchFields: ["name", "email", "position"],
  defaultSort: { createdAt: -1 },
  documentName: "CareerApplication",
});

// PUBLIC - apply: create new application (multipart, resume PDF optional)
export const apply = asyncHandler(async (req, res) => {
  const body = req.body;
  if (req.file) {
    const file = await uploadFile(req.file, { folder: "skyntrix/resumes", resourceType: "raw" });
    body.resume = file.url;
    body.resumePublicId = file.public_id;
  }
  const doc = await Career.create(body);
  // Fire-and-forget notification
  sendCareerNotification(doc).catch(() => {});
  invalidateChartsCache();
  return ApiResponse.created(res, "Application submitted", doc);
});

// PUBLIC - list open positions (status-based). Placeholder uses positions from applications.
export const listJobs = asyncHandler(async (req, res) => {
  const pipeline = [
    { $group: { _id: "$position", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];
  const jobs = await Career.aggregate(pipeline);
  return ApiResponse.ok(res, "Jobs fetched", jobs);
});

// ADMIN - list all applications (with filters)
export const listApplications = base.list;

export const getApplication = asyncHandler(async (req, res) => {
  const doc = await Career.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Application not found");
  return ApiResponse.ok(res, "Application fetched", doc);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const doc = await Career.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!doc) throw ApiError.notFound("Application not found");
  invalidateChartsCache();
  return ApiResponse.ok(res, "Application status updated", doc);
});

export const addNotes = asyncHandler(async (req, res) => {
  const doc = await Career.findByIdAndUpdate(req.params.id, { notes: req.body.notes }, { new: true });
  if (!doc) throw ApiError.notFound("Application not found");
  invalidateChartsCache();
  return ApiResponse.ok(res, "Notes updated", doc);
});

export const deleteApplication = async () => {
  throw ApiError.badRequest("Use dedicated delete route");
};

// Delete application (and its resume on Cloudinary)
export const deleteApp = asyncHandler(async (req, res) => {
  const existing = await Career.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Application not found");
  if (existing.resumePublicId) await deleteFile(existing.resumePublicId, "raw");
  await existing.deleteOne();
  invalidateChartsCache();
  return ApiResponse.ok(res, "Application deleted");
});