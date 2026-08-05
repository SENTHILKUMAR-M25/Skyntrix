import fs from "fs";
import mongoose from "mongoose";
import Quotation from "../models/Quotation.model.js";
import QuotationSendLog from "../models/QuotationSendLog.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { getPaginationMeta } from "../utils/response.js";
import { auditLog } from "../middleware/audit.middleware.js";
import logger from "../utils/logger.js";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";
import {
  generateQuotationNumber,
  generateQuotationPdf,
  sendQuotationWhatsApp,
  deleteQuotationPdf,
  buildQuotationMessage,
} from "../services/quotation.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

const QUOTATION_KEYS = [
  "clientName",
  "businessName",
  "mobile",
  "email",
  "projectName",
  "projectDescription",
  "services",
  "projectTimeline",
  "paymentTerms",
  "advanceAmount",
  "totalAmount",
  "additionalNotes",
  "validUntil",
];

const ACTOR = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
});

const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

const toE164 = (value) => normalizeMobileNumber(value) || String(value).trim();

const normalizeServices = (services) => {
  if (!Array.isArray(services)) return [];
  return services
    .map((s) => ({
      name: String(s?.name || "").trim().slice(0, 200),
      description: String(s?.description || "").trim().slice(0, 500),
      amount: Math.max(0, Number(s?.amount) || 0),
    }))
    .filter((s) => s.name);
};

/** Normalize an incoming quotation payload for persistence. */
const normalizePayload = (payload) => {
  const clean = { ...payload };
  if (clean.mobile) clean.mobile = toE164(clean.mobile);
  if (clean.services) clean.services = normalizeServices(clean.services);
  if (clean.advanceAmount !== undefined) clean.advanceAmount = Math.max(0, Number(clean.advanceAmount) || 0);

  // The grand total is computed from line items when services are present,
  // otherwise the admin-entered total is used.
  if (clean.services?.length) {
    clean.totalAmount = clean.services.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  } else {
    clean.totalAmount = Math.max(0, Number(clean.totalAmount) || 0);
  }

  if (clean.validUntil) clean.validUntil = new Date(clean.validUntil);
  return clean;
};

const sendResultMessage = (result) =>
  result.status === "success"
    ? "Quotation sent on WhatsApp"
    : result.status === "fallback"
      ? "Quotation ready - WhatsApp Web opened (Cloud API not configured)"
      : result.status === "template"
        ? "Quotation template sent - the PDF and message will be delivered automatically when the client replies"
        : result.error
          ? `Quotation send failed: ${result.error}`
          : "Quotation send failed";

const persistSendResult = async ({ quotation, req, result, isRetry = false }) => {
  const ok = result.status === "success" || result.status === "fallback" || result.status === "template";
  quotation.status = ok ? "sent" : "failed";
  quotation.whatsappStatus = result.status === "template" ? "awaiting_reply" : ok ? "sent" : "failed";
  if (ok) quotation.sentAt = new Date();
  await quotation.save();

  await QuotationSendLog.create({
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    clientName: quotation.clientName,
    mobileNumber: quotation.mobile,
    message: buildQuotationMessage(quotation, { includePdfLink: result.status === "fallback" }),
    status: result.status,
    method: result.status === "fallback" ? "web" : "api",
    messageType: result.status === "template" ? "template" : "text",
    awaitingReply: result.status === "template",
    deliveryStatus: result.status === "success" || result.status === "template" ? "sent" : result.status === "failed" ? "failed" : "pending",
    sentAt: ok ? new Date() : null,
    waUrl: result.waUrl || "",
    pdfUrl: quotation.pdfUrl || "",
    providerMessageId: result.textMessageId || result.providerMessageId || "",
    documentMessageId: result.documentMessageId || "",
    templateMessageId: result.templateMessageId || "",
    error: result.error || "",
    isRetry,
    sentBy: req.admin?._id || null,
    sentByName: req.admin?.name || "System",
  });

  auditLog(req, isRetry ? "resend" : "send", "Quotation", quotation._id, `WhatsApp quotation ${quotation.quotationNumber} -> ${result.status}`);
  invalidateChartsCache();
};

/** Rebuild the PDF file from the quotation's current state. */
const regeneratePdf = async (quotation) => {
  const pdf = await generateQuotationPdf(quotation);
  quotation.pdfUrl = pdf.url;
  quotation.pdfPath = pdf.path;
  await quotation.save();
  return quotation;
};

// ============================================================
// CRUD
// ============================================================

export const createQuotation = asyncHandler(async (req, res) => {
  const payload = normalizePayload(pick(req.body, QUOTATION_KEYS));
  payload.quotationNumber = await generateQuotationNumber();
  payload.status = "draft";
  payload.whatsappStatus = "pending";
  Object.assign(payload, ACTOR(req));

  const doc = await Quotation.create(payload);
  auditLog(req, "create", "Quotation", doc._id, `Created quotation ${doc.quotationNumber}`);
  invalidateChartsCache();
  return ApiResponse.created(res, "Quotation draft saved", doc);
});

export const listQuotations = asyncHandler(async (req, res) => {
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
    const term = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { clientName: { $regex: term, $options: "i" } },
      { businessName: { $regex: term, $options: "i" } },
      { mobile: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { projectName: { $regex: term, $options: "i" } },
      { quotationNumber: { $regex: term, $options: "i" } },
    ];
  }

  let sort = { createdAt: -1 };
  const allowedSorts = ["createdAt", "updatedAt", "sentAt", "clientName", "businessName", "totalAmount", "quotationNumber"];
  if (req.query.sort) {
    const [field, dir] = String(req.query.sort).split(":");
    if (allowedSorts.includes(field)) sort = { [field]: dir === "asc" ? 1 : -1 };
  }

  const [data, total] = await Promise.all([
    Quotation.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Quotation.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Quotations fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getQuotation = asyncHandler(async (req, res) => {
  const doc = await Quotation.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound("Quotation not found");
  return ApiResponse.ok(res, "Quotation fetched", doc);
});

export const updateQuotation = asyncHandler(async (req, res) => {
  const doc = await Quotation.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Quotation not found");

  const updates = normalizePayload(pick(req.body, QUOTATION_KEYS));
  const changed = Object.keys(updates).filter((k) => updates[k] !== undefined);
  Object.assign(doc, updates);
  await doc.save();

  // Keep the stored PDF in sync with the latest quotation data.
  if (doc.pdfPath && changed.length) {
    try {
      await regeneratePdf(doc);
    } catch (err) {
      logger.warn(`[Quotation] pdf regen failed for ${doc.quotationNumber}: ${err.message}`);
    }
  }

  auditLog(req, "update", "Quotation", doc._id, `Updated quotation ${doc.quotationNumber}: ${changed.join(", ")}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Quotation updated", doc);
});

export const deleteQuotation = asyncHandler(async (req, res) => {
  const doc = await Quotation.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Quotation not found");
  await QuotationSendLog.deleteMany({ quotationId: doc._id });
  deleteQuotationPdf(doc.pdfPath);
  auditLog(req, "delete", "Quotation", doc._id, `Deleted quotation ${doc.quotationNumber}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Quotation deleted");
});

// ============================================================
// Send / resend / download
// ============================================================

/**
 * POST /quotations/send
 * Creates (or updates) a quotation, generates the PDF and sends it on WhatsApp.
 * Body may include `quotationId` to target an existing record.
 */
export const sendQuotation = asyncHandler(async (req, res) => {
  let quotation = null;
  if (req.body.quotationId) {
    quotation = await Quotation.findById(req.body.quotationId);
    if (!quotation) throw ApiError.notFound("Quotation not found");
    const updates = normalizePayload(pick(req.body, QUOTATION_KEYS));
    Object.assign(quotation, updates);
    await quotation.save();
  } else {
    const payload = normalizePayload(pick(req.body, QUOTATION_KEYS));
    payload.quotationNumber = await generateQuotationNumber();
    payload.status = "draft";
    payload.whatsappStatus = "pending";
    Object.assign(payload, ACTOR(req));
    quotation = await Quotation.create(payload);
  }

  // Any failure in PDF generation, cloud upload or the WhatsApp API is caught
  // here so the quotation + a send log are persisted as "failed" and the admin
  // gets a clear error instead of a generic 500.
  let result = { status: "failed", error: "Unknown error while sending" };
  try {
    await regeneratePdf(quotation);
    result = await sendQuotationWhatsApp(quotation);
  } catch (err) {
    logger.error(`[Quotation] send failed for ${quotation.quotationNumber}: ${err.message}`);
    result = { status: "failed", error: err.message || "PDF generation or WhatsApp send failed" };
  }
  await persistSendResult({ quotation, req, result });

  return ApiResponse.ok(res, sendResultMessage(result), {
    quotation: quotation.toObject(),
    status: result.status,
    message: result.status === "failed"
      ? result.error
      : result.status === "template"
        ? sendResultMessage(result)
        : buildQuotationMessage(quotation, { includePdfLink: result.status === "fallback" }),
    waUrl: result.waUrl || "",
    pdfUrl: quotation.pdfUrl || "",
    templateMessageId: result.templateMessageId || "",
  });
});

export const resendQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");

  let result = { status: "failed", error: "Unknown error while sending" };
  try {
    await regeneratePdf(quotation);
    result = await sendQuotationWhatsApp(quotation);
  } catch (err) {
    logger.error(`[Quotation] resend failed for ${quotation.quotationNumber}: ${err.message}`);
    result = { status: "failed", error: err.message || "PDF generation or WhatsApp send failed" };
  }
  await persistSendResult({ quotation, req, result, isRetry: true });

  return ApiResponse.ok(res, sendResultMessage(result), {
    quotation: quotation.toObject(),
    status: result.status,
    message: result.status === "failed"
      ? result.error
      : result.status === "template"
        ? sendResultMessage(result)
        : buildQuotationMessage(quotation, { includePdfLink: result.status === "fallback" }),
    waUrl: result.waUrl || "",
    pdfUrl: quotation.pdfUrl || "",
    templateMessageId: result.templateMessageId || "",
  });
});

export const downloadQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");

  if (!quotation.pdfPath || !fs.existsSync(quotation.pdfPath)) {
    await regeneratePdf(quotation);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${quotation.quotationNumber}.pdf"`);
  res.setHeader("Cache-Control", "private, max-age=60");
  fs.createReadStream(quotation.pdfPath).pipe(res);
});

// ============================================================
// Stats & send history
// ============================================================

export const getQuotationStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, draft, sent, failed, pending, sentToday, monthly, totalValue, sentValue] = await Promise.all([
    Quotation.countDocuments(),
    Quotation.countDocuments({ status: "draft" }),
    Quotation.countDocuments({ status: "sent" }),
    Quotation.countDocuments({ status: "failed" }),
    Quotation.countDocuments({ whatsappStatus: "pending" }),
    Quotation.countDocuments({ sentAt: { $gte: todayStart } }),
    Quotation.countDocuments({ createdAt: { $gte: monthStart } }),
    Quotation.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]).then((r) => r[0]?.total || 0),
    Quotation.aggregate([{ $match: { status: "sent" } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]).then((r) => r[0]?.total || 0),
  ]);

  return ApiResponse.ok(res, "Quotation stats", {
    total,
    draft,
    sent,
    failed,
    pending,
    sentToday,
    monthly,
    totalValue,
    sentValue,
  });
});

export const getQuotationSendLogs = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation id");
  const quotation = await Quotation.exists({ _id: req.params.id });
  if (!quotation) throw ApiError.notFound("Quotation not found");

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    QuotationSendLog.find({ quotationId: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    QuotationSendLog.countDocuments({ quotationId: req.params.id }),
  ]);

  return ApiResponse.ok(res, "Quotation send logs fetched", data, getPaginationMeta(pageNum, limitNum, total));
});
