import path from "path";
import Lead, { LEAD_PRIORITY } from "../models/Lead.model.js";
import LeadHistory from "../models/LeadHistory.model.js";
import Quotation from "../models/Quotation.model.js";
import Invoice from "../models/Invoice.model.js";
import Admin from "../models/Admin.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { listDocuments } from "../services/query.service.js";
import { getPaginationMeta } from "../utils/response.js";
import { sendLeadNotification } from "../services/mailer.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";
import {
  PIPELINE_STAGES,
  TERMINAL_STAGE,
  LEGACY_STAGE,
  moveLeadStage,
  recordLeadActivity,
  stageMeta,
} from "../services/pipeline.service.js";
import { uploadFile, deleteFile, removeTempFile } from "../services/cloudinary.service.js";

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

  if (req.body.priority && LEAD_PRIORITY.includes(req.body.priority)) update.priority = req.body.priority;
  if (req.body.assignedTo !== undefined) update.assignedTo = req.body.assignedTo || null;
  if (req.body.assignedToName !== undefined) update.assignedToName = String(req.body.assignedToName || "").slice(0, 100);
  if (req.body.dueDate !== undefined) update.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (req.body.dealValue !== undefined) update.dealValue = Math.max(0, Number(req.body.dealValue) || 0);
  if (req.body.probability !== undefined) update.probability = Math.min(100, Math.max(0, Number(req.body.probability) || 0));
  if (req.body.closeReason !== undefined) update.closeReason = String(req.body.closeReason || "").slice(0, 500);
  if (Array.isArray(req.body.tags)) update.tags = req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);

  // Resolve the assignee display name when only an id was sent.
  if (update.assignedTo && !update.assignedToName) {
    const admin = await Admin.findById(update.assignedTo).select("name");
    if (admin) update.assignedToName = admin.name;
  }

  const doc = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) throw ApiError.notFound("Lead not found");

  if (Object.keys(update).length) {
    await recordLeadActivity({
      leadId: doc._id,
      action: "lead_updated",
      title: "Lead details updated",
      note: Object.keys(update).join(", "),
      actor: getActor(req),
    });
  }

  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead updated", doc);
});

// Manual stage move (any direction) + optional opportunity field updates.
export const updateStatus = asyncHandler(async (req, res) => {
  const doc = await Lead.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");

  const note = (req.body.note || "").trim();
  const moved = await moveLeadStage({
    lead: doc,
    newStage: req.body.status,
    actor: getActor(req),
    note,
    action: "stage_change",
    title: `Moved to ${stageMeta(req.body.status).label}`,
  });

  const patch = {};
  if (req.body.priority && LEAD_PRIORITY.includes(req.body.priority)) patch.priority = req.body.priority;
  if (req.body.assignedTo !== undefined) patch.assignedTo = req.body.assignedTo || null;
  if (req.body.assignedToName !== undefined) patch.assignedToName = String(req.body.assignedToName || "").slice(0, 100);
  if (req.body.dueDate !== undefined) patch.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (req.body.dealValue !== undefined) patch.dealValue = Math.max(0, Number(req.body.dealValue) || 0);
  if (req.body.probability !== undefined) patch.probability = Math.min(100, Math.max(0, Number(req.body.probability) || 0));
  if (req.body.closeReason !== undefined) patch.closeReason = String(req.body.closeReason || "").slice(0, 500);

  if (patch.assignedTo && !patch.assignedToName) {
    const admin = await Admin.findById(patch.assignedTo).select("name");
    if (admin) patch.assignedToName = admin.name;
  }

  if (Object.keys(patch).length) {
    Object.assign(moved, patch);
    await moved.save();
    invalidateChartsCache();
  }

  return ApiResponse.ok(res, "Lead stage updated", moved);
});

// GET /leads/admin/pipeline/board - grouped Kanban data with filters.
export const getPipelineBoard = asyncHandler(async (req, res) => {
  const { search, priority, assignedTo, overdue } = req.query;
  const filter = {};
  if (priority && priority !== "all") filter.priority = priority;
  if (assignedTo && assignedTo !== "all") filter.assignedTo = assignedTo;

  if (search && String(search).trim()) {
    const term = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { company: { $regex: term, $options: "i" } },
      { service: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { tags: { $regex: term, $options: "i" } },
    ];
  }

  const now = new Date();
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();

  const columns = [
    ...PIPELINE_STAGES.map((s) => ({ ...s, leads: [] })),
    { stage: TERMINAL_STAGE, label: "Closed / Lost", phase: "Terminal", color: "slate", leads: [] },
    { stage: LEGACY_STAGE, label: "Converted (legacy)", phase: "Terminal", color: "slate", leads: [] },
  ];

  const valueByStage = {};
  const countByStage = {};
  leads.forEach((lead) => {
    if ((overdue === "1" || overdue === "true") && (!lead.dueDate || new Date(lead.dueDate) >= now)) return;
    const col = columns.find((c) => c.stage === lead.status);
    if (!col) return;
    col.leads.push(lead);
    valueByStage[col.stage] = (valueByStage[col.stage] || 0) + (Number(lead.dealValue) || 0);
    countByStage[col.stage] = (countByStage[col.stage] || 0) + 1;
  });

  const board = columns.map((c) => ({
    ...c,
    count: countByStage[c.stage] || 0,
    value: valueByStage[c.stage] || 0,
  }));

  const totalValue = leads.reduce((a, l) => a + (Number(l.dealValue) || 0), 0);
  const overdueCount = leads.filter((l) => l.dueDate && new Date(l.dueDate) < now).length;
  const upcomingCount = leads.filter((l) => l.dueDate && new Date(l.dueDate) >= now).length;

  return ApiResponse.ok(res, "Pipeline board fetched", {
    board,
    summary: { totalCount: leads.length, totalValue, overdueCount, upcomingCount },
  });
});

// GET /leads/admin/pipeline/notifications - follow-ups, reminders, overdue invoices, delayed milestones.
export const getPipelineNotifications = asyncHandler(async (req, res) => {
  const now = new Date();
  const pastDue = { $ne: null, $lt: now };

  const [followUps, pendingReminders, upcomingReminders, overdueInvoices, delayedMilestones] = await Promise.all([
    Lead.find({
      status: { $in: ["new", "contacted", "meeting_scheduled", "requirement_collected", "quotation_sent", "follow_up", "approved"] },
      dueDate: pastDue,
    })
      .sort({ dueDate: 1 })
      .limit(25)
      .lean(),
    Lead.find({ reminders: { $elemMatch: { completed: false, dueAt: { $lte: now } } } })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Lead.find({ reminders: { $elemMatch: { completed: false, dueAt: { $gt: now } } } })
      .select("name company status reminders")
      .sort({ createdAt: -1 })
      .limit(15)
      .lean(),
    Invoice.find({ status: "sent", dueDate: { $ne: null, $lt: now }, balanceDue: { $gt: 0 } })
      .sort({ dueDate: 1 })
      .limit(25)
      .lean(),
    Lead.find({ status: { $in: ["project_started", "design_approval", "development", "testing"] }, dueDate: pastDue })
      .sort({ dueDate: 1 })
      .limit(25)
      .lean(),
  ]);

  const formatLead = (lead) => ({
    _id: lead._id,
    name: lead.name,
    company: lead.company || "",
    status: lead.status,
    dueDate: lead.dueDate || null,
    dealValue: lead.dealValue || 0,
    reminders: lead.reminders || [],
  });

  return ApiResponse.ok(res, "Pipeline notifications fetched", {
    followUps: followUps.map(formatLead),
    pendingReminders: pendingReminders.map(formatLead),
    upcomingReminders: upcomingReminders.map(formatLead),
    overdueInvoices: overdueInvoices.map((i) => ({
      _id: i._id,
      invoiceNumber: i.invoiceNumber,
      clientName: i.clientName,
      projectName: i.projectName,
      dueDate: i.dueDate,
      balanceDue: i.balanceDue,
      status: i.status,
      paymentStatus: i.paymentStatus,
      leadId: i.leadId || null,
    })),
    delayedMilestones: delayedMilestones.map(formatLead),
  });
});

// GET /leads/admin/:id/overview - single profile bundle: lead + quotations +
// invoices + payments + activity + reminders (drives the unified profile page).
export const getLeadOverview = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const [quotations, invoices, activities] = await Promise.all([
    Quotation.find({ $or: [{ leadId: lead._id }, { email: lead.email }] }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ leadId: lead._id }).sort({ createdAt: -1 }).lean(),
    LeadHistory.find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  // Pull invoices linked via the lead's quotations.
  const quotationIds = quotations.map((q) => q._id);
  let invoicesForLead = invoices;
  if (quotationIds.length) {
    const linked = await Invoice.find({ quotationId: { $in: quotationIds } }).sort({ createdAt: -1 }).lean();
    const seen = new Set(invoicesForLead.map((i) => String(i._id)));
    invoicesForLead = [...invoicesForLead, ...linked.filter((i) => !seen.has(String(i._id)))];
  }

  const payments = [];
  invoicesForLead.forEach((inv) =>
    (inv.payments || []).forEach((p) =>
      payments.push({
        ...p,
        _id: p._id,
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        totalAmount: inv.totalAmount,
      })
    )
  );
  payments.sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

  const totalQuoted = quotations.reduce((a, q) => a + (Number(q.totalAmount) || 0), 0);
  const amountPaid = invoicesForLead.reduce((a, i) => a + (Number(i.amountPaid) || 0), 0);
  const balanceDue = invoicesForLead.reduce((a, i) => a + (Number(i.balanceDue) || 0), 0);

  return ApiResponse.ok(res, "Lead overview fetched", {
    lead,
    quotations,
    invoices: invoicesForLead,
    payments,
    activities,
    openReminders: (lead.reminders || []).filter((r) => !r.completed),
    summary: {
      quotationCount: quotations.length,
      invoiceCount: invoicesForLead.length,
      totalQuoted,
      amountPaid,
      balanceDue,
      approvedQuotation: quotations.find((q) => q.approved) || null,
    },
  });
});

// ============================================================
// Reminders
// ============================================================

export const addLeadReminder = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const title = (req.body.title || "").trim();
  if (!title) throw ApiError.badRequest("Reminder title is required");

  lead.reminders.push({
    title,
    note: (req.body.note || "").trim(),
    dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
    createdBy: req.admin?._id || null,
    createdByName: req.admin?.name || "System",
  });
  await lead.save();

  const created = lead.reminders[lead.reminders.length - 1];
  await recordLeadActivity({
    leadId: lead._id,
    action: "reminder_added",
    title: `Reminder set: ${created.title}`,
    note: created.note,
    reminderAt: created.dueAt,
    actor: getActor(req),
  });
  invalidateChartsCache();
  return ApiResponse.created(res, "Reminder added", created);
});

export const updateLeadReminder = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const reminder = lead.reminders.id(req.params.reminderId);
  if (!reminder) throw ApiError.notFound("Reminder not found");

  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) throw ApiError.badRequest("Reminder title cannot be empty");
    reminder.title = title;
  }
  if (req.body.note !== undefined) reminder.note = String(req.body.note || "").trim();
  if (req.body.dueAt !== undefined) reminder.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
  if (req.body.completed !== undefined) {
    reminder.completed = Boolean(req.body.completed);
    reminder.completedAt = reminder.completed ? new Date() : null;
  }
  await lead.save();

  if (req.body.completed) {
    await recordLeadActivity({
      leadId: lead._id,
      action: "reminder_completed",
      title: `Reminder completed: ${reminder.title}`,
      actor: getActor(req),
    });
  }
  invalidateChartsCache();
  return ApiResponse.ok(res, "Reminder updated", reminder);
});

export const deleteLeadReminder = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const reminder = lead.reminders.id(req.params.reminderId);
  if (!reminder) throw ApiError.notFound("Reminder not found");

  const title = reminder.title;
  lead.reminders.pull({ _id: reminder._id });
  await lead.save();

  await recordLeadActivity({
    leadId: lead._id,
    action: "reminder_added",
    title: `Reminder removed: ${title}`,
    actor: getActor(req),
  });
  invalidateChartsCache();
  return ApiResponse.ok(res, "Reminder deleted");
});

// ============================================================
// Attachments
// ============================================================

export const uploadLeadAttachment = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");
  if (!req.file) throw ApiError.badRequest("No file provided");

  const resourceType = req.file.mimetype.startsWith("image/") ? "image" : "raw";
  let uploaded;
  try {
    uploaded = await uploadFile(req.file, { resourceType, folder: "skyntrix/leads" });
  } finally {
    removeTempFile(req.file.path);
  }

  const attachment = {
    name: path.basename(req.file.originalname),
    url: uploaded.url,
    publicId: uploaded.public_id || "",
    size: uploaded.bytes || req.file.size || 0,
    stage: (req.body.stage || lead.status || "").trim(),
    uploadedBy: req.admin?._id || null,
    uploadedByName: req.admin?.name || "System",
  };
  lead.attachments.push(attachment);
  await lead.save();

  await recordLeadActivity({
    leadId: lead._id,
    action: "attachment_added",
    title: `Attachment added: ${attachment.name}`,
    note: (req.body.note || "").trim(),
    attachment: attachment.url,
    actor: getActor(req),
  });
  invalidateChartsCache();
  return ApiResponse.created(res, "Attachment added", attachment);
});

export const deleteLeadAttachment = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const attachment = lead.attachments.id(req.params.attachmentId);
  if (!attachment) throw ApiError.notFound("Attachment not found");

  const name = attachment.name;
  const publicId = attachment.publicId;
  lead.attachments.pull({ _id: attachment._id });
  await lead.save();

  try {
    if (publicId) await deleteFile(publicId, "raw");
  } catch (err) {
    // Non-fatal: stale cloud files are harmless.
  }

  await recordLeadActivity({
    leadId: lead._id,
    action: "attachment_deleted",
    title: `Attachment removed: ${name}`,
    actor: getActor(req),
  });
  invalidateChartsCache();
  return ApiResponse.ok(res, "Attachment deleted");
});

// ============================================================
// History / notes
// ============================================================

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

  const record = await recordLeadActivity({
    leadId: lead._id,
    action: "note",
    title: "Note added",
    note,
    actor: getActor(req),
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
