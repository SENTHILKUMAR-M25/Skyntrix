import Lead from "../models/Lead.model.js";
import LeadHistory from "../models/LeadHistory.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { listDocuments } from "../services/query.service.js";
import { getPaginationMeta } from "../utils/response.js";
import { sendLeadNotification } from "../services/mailer.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

// Roles that can manage any note/history entry regardless of ownership.
const MANAGER_ROLES = ["super-admin", "admin"];

const getActor = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
  createdByAvatar: req.admin?.avatar || "",
});

// Ownership + permission rules applied on the backend for edit/delete.
const manageRecord = (record, admin) => {
  const isOwner = !!record.createdBy && String(record.createdBy) === String(admin._id);
  const isManager = MANAGER_ROLES.includes(admin.role);
  const canEdit = isOwner || isManager;
  const canDelete = isManager || (isOwner && !!admin.permissions?.delete);
  return { isOwner, canEdit, canDelete };
};

// PUBLIC - submit contact form
export const createLead = asyncHandler(async (req, res) => {
  const body = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone || "",
    company: req.body.company || "",
    service: req.body.service || req.body.type || req.body.serviceFrom || "",
    budget: req.body.budget || "",
    message: req.body.message || "",
    source: req.body.source || (req.get("origin") || ""),
  };

  const lead = await Lead.create(body);
  sendLeadNotification(lead).catch(() => {});
  invalidateChartsCache();

  return ApiResponse.created(res, "Thank you! We will get back to you soon.", {
    id: lead._id,
    name: lead.name,
    email: lead.email,
  });
});

export const listLeads = asyncHandler(async (req, res) => {
  const { data, meta } = await listDocuments(Lead, req, {
    searchFields: ["name", "email", "company", "service"],
    defaultSort: { createdAt: -1 },
    statusField: "status",
  });
  return ApiResponse.ok(res, "Leads fetched", data, meta);
});

export const getLead = asyncHandler(async (req, res) => {
  const doc = await Lead.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");
  return ApiResponse.ok(res, "Lead fetched", doc);
});

export const updateLead = asyncHandler(async (req, res) => {
  const allowed = ["name", "email", "phone", "company", "service", "budget", "message", "notes"];
  const update = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  const doc = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) throw ApiError.notFound("Lead not found");
  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead updated", doc);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const doc = await Lead.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");

  const previousStatus = doc.status;
  const newStatus = req.body.status;
  const note = (req.body.note || "").trim();

  doc.status = newStatus;
  await doc.save();

  await LeadHistory.create({
    leadId: doc._id,
    previousStatus,
    newStatus,
    note,
    ...getActor(req),
  });

  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead status updated", doc);
});

// GET /leads/admin/:id/history - paginated, filterable activity history (latest first)
export const getLeadHistory = asyncHandler(async (req, res) => {
  const lead = await Lead.exists({ _id: req.params.id });
  if (!lead) throw ApiError.notFound("Lead not found");

  const { page = 1, limit = 20, status, from, to } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = { leadId: req.params.id };
  if (status && status !== "all") filter.newStatus = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const [data, total] = await Promise.all([
    LeadHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    LeadHistory.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Lead history fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

// POST /leads/admin/:id/history - add a note without changing status
export const addLeadNote = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");
  const note = (req.body.note || "").trim();
  if (!note) throw ApiError.badRequest("Note content is required");

  const record = await LeadHistory.create({
    leadId: lead._id,
    previousStatus: lead.status,
    newStatus: lead.status,
    note,
    ...getActor(req),
  });
  invalidateChartsCache();
  return ApiResponse.created(res, "Note added", record);
});

// PUT /leads/admin/history/:historyId - edit a note's content
export const updateHistoryNote = asyncHandler(async (req, res) => {
  const record = await LeadHistory.findById(req.params.historyId);
  if (!record) throw ApiError.notFound("Note not found");
  if (!manageRecord(record, req.admin).canEdit) {
    throw ApiError.forbidden("You can only edit notes you created.");
  }

  const note = (req.body.note || "").trim();
  if (!note) throw ApiError.badRequest("Note content is required");
  record.note = note;
  await record.save();
  invalidateChartsCache();
  return ApiResponse.ok(res, "Note updated", record);
});

// DELETE /leads/admin/history/:historyId - remove a note's record
export const deleteHistoryNote = asyncHandler(async (req, res) => {
  const record = await LeadHistory.findById(req.params.historyId);
  if (!record) throw ApiError.notFound("Note not found");
  if (!manageRecord(record, req.admin).canDelete) {
    throw ApiError.forbidden("You can only delete notes you created.");
  }
  await record.deleteOne();
  invalidateChartsCache();
  return ApiResponse.ok(res, "Note deleted");
});

export const deleteLead = asyncHandler(async (req, res) => {
  const doc = await Lead.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");
  await LeadHistory.deleteMany({ leadId: doc._id });
  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead deleted");
});
