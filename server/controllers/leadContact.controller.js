import mongoose from "mongoose";
import Lead from "../models/Lead.model.js";
import LeadContact from "../models/LeadContact.model.js";
import LeadContactHistory from "../models/LeadContactHistory.model.js";
import WhatsAppSendLog from "../models/WhatsAppSendLog.model.js";
import Admin from "../models/Admin.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { getPaginationMeta } from "../utils/response.js";
import { auditLog } from "../middleware/audit.middleware.js";
import { buildWhatsAppMessage, normalizeMobileNumber, sendWhatsAppMessage, buildWaMeUrl } from "../services/whatsapp.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

const ACTOR = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
});

const addHistory = (leadContactId, req, action, description, meta = {}) =>
  LeadContactHistory.create({ leadContactId, action, description, meta, ...ACTOR(req) }).catch(() => {});

const addSendLog = (req, log) =>
  WhatsAppSendLog.create({ ...log, sentBy: req.admin?._id || null, sentByName: req.admin?.name || "System" }).catch(() => {});

const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

const CONTACT_KEYS = ["businessName", "mobileNumber", "summary", "demoLink", "websiteLink", "notes", "tags", "followUpStatus", "nextFollowUpAt", "assignedTo"];

const toE164 = (value) => normalizeMobileNumber(value) || String(value).trim();

const applyAssignedName = async (payload) => {
  if (payload.assignedTo) {
    const admin = await Admin.findById(payload.assignedTo).select("name").lean().catch(() => null);
    if (admin) payload.assignedToName = admin.name;
  }
  return payload;
};

// ============================================================
// CRUD
// ============================================================

export const createLeadContact = asyncHandler(async (req, res) => {
  const payload = pick(req.body, [...CONTACT_KEYS, "status"]);
  if (payload.mobileNumber) payload.mobileNumber = toE164(payload.mobileNumber);
  payload.status = "draft";
  await applyAssignedName(payload);
  Object.assign(payload, ACTOR(req));

  const doc = await LeadContact.create(payload);
  await addHistory(doc._id, req, "create", `Lead created for ${doc.businessName}`);
  auditLog(req, "create", "LeadContact", doc._id, `Created lead contact: ${doc.businessName}`);
  invalidateChartsCache();

  return ApiResponse.created(res, "Lead created successfully", doc);
});

export const listLeadContacts = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  const { search, status, whatsappStatus, from, to } = req.query;

  if (status && status !== "all") filter.status = status;
  if (whatsappStatus && whatsappStatus !== "all") filter.whatsappStatus = whatsappStatus;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { businessName: { $regex: escaped, $options: "i" } },
      { mobileNumber: { $regex: escaped, $options: "i" } },
      { summary: { $regex: escaped, $options: "i" } },
      { tags: { $regex: escaped, $options: "i" } },
    ];
  }

  let sort = { createdAt: -1 };
  const allowedSorts = ["businessName", "mobileNumber", "createdAt", "updatedAt"];
  if (req.query.sort) {
    const [field, dir] = String(req.query.sort).split(":");
    if (allowedSorts.includes(field)) sort = { [field]: dir === "asc" ? 1 : -1 };
  }

  const [data, total] = await Promise.all([
    LeadContact.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    LeadContact.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Leads fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getLeadContact = asyncHandler(async (req, res) => {
  const doc = await LeadContact.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound("Lead not found");
  return ApiResponse.ok(res, "Lead fetched", doc);
});

export const updateLeadContact = asyncHandler(async (req, res) => {
  const doc = await LeadContact.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");

  const updates = pick(req.body, [...CONTACT_KEYS, "status", "whatsappStatus"]);
  if (updates.mobileNumber) updates.mobileNumber = toE164(updates.mobileNumber);
  if (updates.assignedTo) await applyAssignedName(updates);

  const changed = Object.keys(updates).filter((k) => updates[k] !== undefined);
  Object.assign(doc, updates);
  await doc.save();

  if (changed.length) {
    const only = (keys) => changed.length === keys.length && keys.every((k) => changed.includes(k));
    let action = "update";
    let description = `Updated ${changed.join(", ")}`;
    if (only(["notes"])) { action = "note"; description = "Note updated"; }
    else if (only(["followUpStatus", "nextFollowUpAt"]) || only(["followUpStatus"]) || only(["nextFollowUpAt"])) { action = "follow-up"; description = "Follow-up updated"; }
    else if (only(["assignedTo"])) { action = "assign"; description = "Lead reassigned"; }
    await addHistory(doc._id, req, action, description);
    auditLog(req, "update", "LeadContact", doc._id, `Updated lead contact: ${doc.businessName}`);
  }

  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead updated", doc);
});

export const deleteLeadContact = asyncHandler(async (req, res) => {
  const doc = await LeadContact.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Lead not found");
  await Promise.all([
    LeadContactHistory.deleteMany({ leadContactId: doc._id }),
    WhatsAppSendLog.deleteMany({ leadContactId: doc._id }),
  ]);
  await addHistory(doc._id, req, "delete", `Deleted lead: ${doc.businessName}`);
  auditLog(req, "delete", "LeadContact", doc._id, `Deleted lead contact: ${doc.businessName}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Lead deleted");
});

/** Convert a contact-form Lead into a Lead Contact so it can get WhatsApp outreach. */
export const convertContactLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  if (!mongoose.isValidObjectId(leadId)) throw ApiError.badRequest("Invalid lead id");

  const lead = await Lead.findById(leadId);
  if (!lead) throw ApiError.notFound("Contact form lead not found");

  const mobileNumber = normalizeMobileNumber(lead.phone);
  if (!mobileNumber) {
    throw ApiError.badRequest(`Cannot convert "${lead.name}": the inquiry has no valid mobile number`);
  }

  const existing = await LeadContact.findOne({ sourceLead: lead._id });
  if (existing) {
    return ApiResponse.ok(res, "Lead was already converted", { lead: existing, alreadyConverted: true });
  }

  const businessName = (lead.company || lead.name || "Business").trim().slice(0, 200);
  const summary = (lead.message || `Inquiry regarding ${lead.service || "our services"}`).trim().slice(0, 2000);
  const notes = `Converted from contact form inquiry by ${lead.name}${lead.email ? ` <${lead.email}>` : ""}${lead.budget ? ` · budget: ${lead.budget}` : ""}`;

  const doc = await LeadContact.create({
    businessName,
    mobileNumber,
    summary,
    notes,
    status: "draft",
    sourceLead: lead._id,
    sourceLabel: "Contact form",
    ...ACTOR(req),
  });

  await addHistory(doc._id, req, "create", `Converted from contact form lead "${lead.name}"`);
  auditLog(req, "create", "LeadContact", doc._id, `Converted contact lead: ${businessName}`);
  invalidateChartsCache();

  return ApiResponse.created(res, "Converted to Lead Contact", doc);
});

// ============================================================
// WhatsApp send flow
// ============================================================

const persistSendResult = async ({ lead, req, message, result, isRetry = false }) => {
  const ok = result.status === "success" || result.status === "fallback";
  lead.status = ok ? "sent" : "failed";
  lead.whatsappStatus = ok ? "sent" : "failed";
  await lead.save();

  await addSendLog(req, {
    leadContactId: lead._id,
    businessName: lead.businessName,
    mobileNumber: lead.mobileNumber,
    message,
    status: result.status,
    method: result.status === "success" ? "api" : "web",
    waUrl: result.waUrl || "",
    providerMessageId: result.providerMessageId || "",
    error: result.error || "",
    isRetry,
  });

  await addHistory(
    lead._id,
    req,
    isRetry ? "resend" : "send",
    result.status === "success"
      ? `WhatsApp message sent via Cloud API`
      : result.status === "fallback"
        ? "WhatsApp opened via wa.me (Cloud API not configured)"
        : `WhatsApp send failed: ${result.error}`,
    { status: result.status, error: result.error || "", waUrl: result.waUrl || "" }
  );

  auditLog(req, isRetry ? "resend" : "send", "LeadContact", lead._id, `WhatsApp ${result.status} for ${lead.businessName}`);
  invalidateChartsCache();
};

/**
 * POST /send-whatsapp
 * Creates or updates a lead then sends the WhatsApp message.
 * Body may include `leadId` to target an existing record.
 */
export const sendWhatsApp = asyncHandler(async (req, res) => {
  let lead;
  if (req.body.leadId) {
    lead = await LeadContact.findById(req.body.leadId);
    if (!lead) throw ApiError.notFound("Lead not found");
    const updates = pick(req.body, CONTACT_KEYS);
    if (updates.mobileNumber) updates.mobileNumber = toE164(updates.mobileNumber);
    Object.assign(lead, updates);
  } else {
    const payload = pick(req.body, CONTACT_KEYS);
    if (payload.mobileNumber) payload.mobileNumber = toE164(payload.mobileNumber);
    await applyAssignedName(payload);
    Object.assign(payload, ACTOR(req));
    lead = await LeadContact.create(payload);
    await addHistory(lead._id, req, "create", `Lead created for ${lead.businessName}`);
  }

  const message = buildWhatsAppMessage(lead);
  const result = await sendWhatsAppMessage({ to: lead.mobileNumber, body: message });
  await persistSendResult({ lead, req, message, result });

  const msg =
    result.status === "success"
      ? "WhatsApp sent successfully"
      : result.status === "fallback"
        ? "WhatsApp Web opened - Cloud API not configured"
        : "WhatsApp send failed";

  return ApiResponse.ok(res, msg, {
    lead: lead.toObject(),
    status: result.status,
    message,
    waUrl: result.waUrl || "",
  });
});

export const resendWhatsApp = asyncHandler(async (req, res) => {
  const lead = await LeadContact.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");

  const message = buildWhatsAppMessage(lead);
  const result = await sendWhatsAppMessage({ to: lead.mobileNumber, body: message });
  await persistSendResult({ lead, req, message, result, isRetry: true });

  const msg =
    result.status === "success"
      ? "WhatsApp resent successfully"
      : result.status === "fallback"
        ? "WhatsApp Web opened - Cloud API not configured"
        : "WhatsApp resend failed";

  return ApiResponse.ok(res, msg, {
    lead: lead.toObject(),
    status: result.status,
    message,
    waUrl: result.waUrl || "",
  });
});

export const bulkSendWhatsApp = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  const leads = await LeadContact.find({ _id: { $in: ids } });
  if (!leads.length) throw ApiError.notFound("No matching leads found");

  const results = [];
  for (const lead of leads) {
    const message = buildWhatsAppMessage(lead);
    const result = await sendWhatsAppMessage({ to: lead.mobileNumber, body: message });
    await persistSendResult({ lead, req, message, result, isRetry: lead.status === "failed" });
    results.push({ id: lead._id, businessName: lead.businessName, status: result.status, waUrl: result.waUrl || "" });
  }

  const sent = results.filter((r) => r.status !== "failed").length;
  return ApiResponse.ok(res, `Processed ${results.length} lead(s)`, { results, sent, failed: results.length - sent });
});

export const bulkDeleteLeadContacts = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  const docs = await LeadContact.find({ _id: { $in: ids } }).select("_id businessName").lean();
  if (!docs.length) throw ApiError.notFound("No matching leads found");

  await Promise.all([
    LeadContact.deleteMany({ _id: { $in: ids } }),
    LeadContactHistory.deleteMany({ leadContactId: { $in: ids } }),
    WhatsAppSendLog.deleteMany({ leadContactId: { $in: ids } }),
  ]);

  await addHistory(req.body.ids?.[0], req, "delete", `Bulk deleted ${docs.length} lead(s)`);
  auditLog(req, "delete", "LeadContact", null, `Bulk deleted ${docs.length} lead contacts`);
  invalidateChartsCache();
  return ApiResponse.ok(res, `Deleted ${docs.length} lead(s)`);
});

// ============================================================
// Import (CSV / Excel export format)
// ============================================================

const normalizeImportRow = (raw) => {
  const row = {
    businessName: String(raw.businessName || "").trim(),
    mobileNumber: String(raw.mobileNumber || "").trim(),
    summary: String(raw.summary || "").trim(),
    demoLink: String(raw.demoLink || "").trim(),
    websiteLink: String(raw.websiteLink || "").trim(),
    notes: String(raw.notes || "").trim(),
  };
  const tags = raw.tags;
  if (typeof tags === "string") {
    row.tags = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
  } else if (Array.isArray(tags)) {
    row.tags = tags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 10);
  } else {
    row.tags = [];
  }

  row.mobileNumber = normalizeMobileNumber(row.mobileNumber) || row.mobileNumber;
  row.demoLink = row.demoLink && /^https?:\/\//i.test(row.demoLink) ? row.demoLink : "";
  row.websiteLink = row.websiteLink && /^https?:\/\//i.test(row.websiteLink) ? row.websiteLink : "";

  const errors = [];
  if (!row.businessName) errors.push({ row: raw, field: "businessName", message: "Business name is required" });
  if (!normalizeMobileNumber(row.mobileNumber)) errors.push({ row: raw, field: "mobileNumber", message: "Invalid mobile number" });
  if (!row.summary) errors.push({ row: raw, field: "summary", message: "Summary is required" });

  if (errors.length) return { errors };
  return { value: row };
};

export const importLeadContacts = asyncHandler(async (req, res) => {
  const leads = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (!leads.length) throw ApiError.badRequest("No leads provided to import");

  const created = [];
  const failures = [];
  const actor = ACTOR(req);

  for (const raw of leads) {
    const { value, errors } = normalizeImportRow(raw);
    if (errors) {
      failures.push(...errors.map((e) => ({ ...e, mobileNumber: raw.mobileNumber, businessName: raw.businessName })));
      continue;
    }
    const doc = await LeadContact.create({ ...value, status: "draft", ...actor });
    created.push(doc._id);
    await addHistory(doc._id, req, "create", `Imported lead for ${doc.businessName}`);
  }

  auditLog(req, "create", "LeadContact", null, `Imported ${created.length} lead contact(s), ${failures.length} failed`);
  invalidateChartsCache();
  return ApiResponse.created(res, `Imported ${created.length} lead(s)`, { imported: created.length, failed: failures.length, failures });
});

// ============================================================
// Stats, sent history, activity timeline
// ============================================================

export const getLeadContactStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    total,
    draft,
    sent,
    failed,
    today,
    monthly,
    sentToday,
    followUps,
  ] = await Promise.all([
    LeadContact.countDocuments(),
    LeadContact.countDocuments({ status: "draft" }),
    LeadContact.countDocuments({ status: "sent" }),
    LeadContact.countDocuments({ status: "failed" }),
    LeadContact.countDocuments({ createdAt: { $gte: todayStart } }),
    LeadContact.countDocuments({ createdAt: { $gte: monthStart } }),
    LeadContact.countDocuments({ whatsappStatus: "sent", createdAt: { $gte: todayStart } }),
    LeadContact.countDocuments({ followUpStatus: "follow-up", nextFollowUpAt: { $gte: now } }),
  ]);

  return ApiResponse.ok(res, "Lead contact stats", {
    total,
    draft,
    sent,
    failed,
    today,
    monthly,
    sentToday,
    followUps,
  });
});

export const getSentHistory = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.q && String(req.query.q).trim()) {
    const term = String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ businessName: { $regex: term, $options: "i" } }, { mobileNumber: { $regex: term, $options: "i" } }];
  }

  const [data, total] = await Promise.all([
    WhatsAppSendLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    WhatsAppSendLog.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Send history fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getLeadContactHistory = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid lead id");
  const lead = await LeadContact.exists({ _id: req.params.id });
  if (!lead) throw ApiError.notFound("Lead not found");

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (pageNum - 1) * limitNum;

  const filter = { leadContactId: req.params.id };
  if (req.query.action && req.query.action !== "all") filter.action = req.query.action;

  const [data, total] = await Promise.all([
    LeadContactHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    LeadContactHistory.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Lead history fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

/** Preview-only: build the message without persisting anything. */
export const previewWhatsApp = asyncHandler(async (req, res) => {
  const payload = pick(req.body, CONTACT_KEYS);
  const message = buildWhatsAppMessage(payload);
  const waUrl = payload.mobileNumber ? buildWaMeUrl(payload.mobileNumber, message) : "";
  return ApiResponse.ok(res, "Message preview", { message, waUrl });
});
