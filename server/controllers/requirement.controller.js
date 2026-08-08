import mongoose from "mongoose";
import Requirement from "../models/Requirement.model.js";
import LeadContact from "../models/LeadContact.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse, { getPaginationMeta } from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { auditLog } from "../middleware/audit.middleware.js";
import { syncContactPipelineStage } from "../services/contactPipeline.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

const ACTOR = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
});

const REQUIREMENT_KEYS = [
  "contactId",
  "leadId",
  "businessName",
  "clientName",
  "mobileNumber",
  "email",
  "location",
  "existingWebsite",
  "socialMediaLinks",
  "projectType",
  "projectName",
  "businessDescription",
  "projectDescription",
  "mainObjective",
  "targetAudience",
  "requiredFeatures",
  "numberOfPages",
  "numberOfProducts",
  "adminPanelRequired",
  "paymentGatewayRequired",
  "authenticationRequired",
  "whatsappIntegration",
  "emailIntegration",
  "thirdPartyIntegrations",
  "hostingRequired",
  "domainRequired",
  "maintenanceRequired",
  "preferredTechnology",
  "frontend",
  "backend",
  "database",
  "apiRequirements",
  "hostingDeploymentRequirements",
  "otherTechnicalRequirements",
  "clientBudget",
  "expectedStartDate",
  "expectedDeliveryDate",
  "priority",
  "estimatedDevelopmentCost",
  "estimatedMaintenanceCost",
  "clientExpectations",
  "referenceWebsites",
  "competitorWebsites",
  "designPreferences",
  "specialInstructions",
  "internalNotes",
];

const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

const normalizePayload = (payload) => {
  const clean = { ...payload };
  if (clean.socialMediaLinks && !Array.isArray(clean.socialMediaLinks)) {
    clean.socialMediaLinks = String(clean.socialMediaLinks)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  ["adminPanelRequired", "paymentGatewayRequired", "authenticationRequired", "whatsappIntegration", "emailIntegration", "hostingRequired", "domainRequired", "maintenanceRequired"].forEach(
    (k) => {
      if (clean[k] !== undefined) clean[k] = toBool(clean[k]);
    }
  );
  ["numberOfPages", "numberOfProducts", "clientBudget", "estimatedDevelopmentCost", "estimatedMaintenanceCost"].forEach((k) => {
    if (clean[k] !== undefined) clean[k] = Math.max(0, Number(clean[k]) || 0);
  });
  if (clean.expectedStartDate) clean.expectedStartDate = new Date(clean.expectedStartDate);
  if (clean.expectedDeliveryDate) clean.expectedDeliveryDate = new Date(clean.expectedDeliveryDate);
  if (clean.email) clean.email = String(clean.email).toLowerCase().trim();
  return clean;
};

/** When the form leaves client fields blank, inherit them from the contact. */
const inheritContactInfo = async (payload) => {
  if (!payload.contactId) return payload;
  const contact = await LeadContact.findById(payload.contactId).lean();
  if (!contact) throw ApiError.badRequest("Linked contact not found");
  const defaults = {
    businessName: contact.businessName || "",
    clientName: contact.contactPerson || contact.businessName || "",
    mobileNumber: contact.mobileNumber || "",
    email: contact.email || "",
    location: contact.location || "",
    existingWebsite: contact.websiteLink || "",
    leadId: contact.sourceLead || null,
  };
  Object.entries(defaults).forEach(([key, value]) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      payload[key] = value;
    }
  });
  return payload;
};

// ============================================================
// CRUD
// ============================================================

export const createRequirement = asyncHandler(async (req, res) => {
  const payload = normalizePayload(pick(req.body, [...REQUIREMENT_KEYS, "status"]));
  if (!payload.contactId) throw ApiError.badRequest("A contact is required to collect a requirement");

  await inheritContactInfo(payload);
  Object.assign(payload, ACTOR(req));
  if (!payload.status) payload.status = "draft";

  const doc = await Requirement.create(payload);
  await syncContactPipelineStage(payload.contactId);
  auditLog(req, "create", "Requirement", doc._id, `Requirement created for ${doc.businessName || doc.contactId}`);
  invalidateChartsCache();

  return ApiResponse.created(res, "Requirement saved", doc);
});

export const getRequirementStats = asyncHandler(async (req, res) => {
  const [total, draft, collected, underReview, ready, readyValue] = await Promise.all([
    Requirement.countDocuments(),
    Requirement.countDocuments({ status: "draft" }),
    Requirement.countDocuments({ status: "collected" }),
    Requirement.countDocuments({ status: "under_review" }),
    Requirement.countDocuments({ status: "ready_for_quotation" }),
    Requirement.aggregate([
      { $match: { status: "ready_for_quotation" } },
      { $group: { _id: null, total: { $sum: "$estimatedDevelopmentCost" } } },
    ]).then((r) => r[0]?.total || 0),
  ]);

  return ApiResponse.ok(res, "Requirement stats", {
    total,
    draft,
    collected,
    underReview,
    ready,
    readyValue,
  });
});

export const listRequirements = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  const { search, status, contactId, priority, projectType, from, to } = req.query;

  if (status && status !== "all") filter.status = status;
  if (contactId && contactId !== "all") filter.contactId = contactId;
  if (priority && priority !== "all") filter.priority = priority;
  if (projectType && projectType !== "all") filter.projectType = projectType;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  if (search && String(search).trim()) {
    const term = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { businessName: { $regex: term, $options: "i" } },
      { clientName: { $regex: term, $options: "i" } },
      { projectName: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { mobileNumber: { $regex: term, $options: "i" } },
    ];
  }

  let sort = { updatedAt: -1 };
  const allowedSorts = ["updatedAt", "createdAt", "businessName", "clientName", "projectName", "clientBudget", "estimatedDevelopmentCost"];
  if (req.query.sort) {
    const [field, dir] = String(req.query.sort).split(":");
    if (allowedSorts.includes(field)) sort = { [field]: dir === "asc" ? 1 : -1 };
  }

  const [data, total] = await Promise.all([
    Requirement.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Requirement.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Requirements fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getRequirement = asyncHandler(async (req, res) => {
  const doc = await Requirement.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound("Requirement not found");
  return ApiResponse.ok(res, "Requirement fetched", doc);
});

export const listRequirementsByContact = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contactId)) throw ApiError.badRequest("Invalid contact id");
  const data = await Requirement.find({ contactId: req.params.contactId }).sort({ updatedAt: -1 }).lean();
  return ApiResponse.ok(res, "Contact requirements fetched", data);
});

/** Requirements that are ready (or further) so they can feed the quotation page. */
export const listReadyRequirements = asyncHandler(async (req, res) => {
  const data = await Requirement.find({ status: "ready_for_quotation" })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return ApiResponse.ok(res, "Ready requirements fetched", data);
});

export const updateRequirement = asyncHandler(async (req, res) => {
  const doc = await Requirement.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Requirement not found");

  const updates = normalizePayload(pick(req.body, [...REQUIREMENT_KEYS, "status"]));
  if (updates.contactId && String(updates.contactId) !== String(doc.contactId)) {
    throw ApiError.badRequest("A requirement cannot be moved to a different contact");
  }
  Object.assign(doc, updates);
  await doc.save();
  await syncContactPipelineStage(doc.contactId);

  auditLog(req, "update", "Requirement", doc._id, `Updated requirement for ${doc.businessName || doc.contactId}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Requirement updated", doc);
});

/** PUT /requirements/:id/status - advance the requirement status. */
export const updateRequirementStatus = asyncHandler(async (req, res) => {
  const doc = await Requirement.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Requirement not found");

  doc.status = req.body.status;
  await doc.save();
  await syncContactPipelineStage(doc.contactId);

  auditLog(req, "update", "Requirement", doc._id, `Requirement status -> ${doc.status}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Requirement status updated", doc);
});

export const deleteRequirement = asyncHandler(async (req, res) => {
  const doc = await Requirement.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Requirement not found");
  await syncContactPipelineStage(doc.contactId);

  auditLog(req, "delete", "Requirement", doc._id, `Deleted requirement for ${doc.businessName || doc.contactId}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Requirement deleted");
});
