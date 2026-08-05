import fs from "fs";
import mongoose from "mongoose";
import Invoice from "../models/Invoice.model.js";
import InvoiceSendLog from "../models/InvoiceSendLog.model.js";
import Quotation from "../models/Quotation.model.js";
import Lead from "../models/Lead.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse, { getPaginationMeta } from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { auditLog } from "../middleware/audit.middleware.js";
import logger from "../utils/logger.js";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";
import {
  generateInvoiceNumber,
  computeInvoiceFinance,
  applyInvoicePaymentState,
  ensureInvoicePdf,
  deleteInvoicePdf,
  sendInvoiceWhatsApp,
  sendInvoiceEmail,
  buildInvoiceMessage,
  refreshProjectPaymentState,
} from "../services/invoice.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";
import { moveLeadStage, recordLeadActivity } from "../services/pipeline.service.js";

const INVOICE_KEYS = [
  "leadId",
  "clientName",
  "businessName",
  "mobile",
  "email",
  "billingAddress",
  "gstin",
  "projectName",
  "projectDescription",
  "items",
  "discount",
  "discountType",
  "taxRate",
  "invoiceDate",
  "dueDate",
  "paymentMethod",
  "type",
  "notes",
  "terms",
];

const ACTOR = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
});

const PIPELINE_ACTOR = (req) => ({
  createdBy: req.admin?._id || null,
  createdByName: req.admin?.name || "System",
  createdByAvatar: req.admin?.avatar || "",
});

// Fields safe to expose on the public, unauthenticated invoice view page.
const PUBLIC_INVOICE_KEYS = [
  "invoiceNumber",
  "quotationNumber",
  "type",
  "clientName",
  "businessName",
  "billingAddress",
  "gstin",
  "projectName",
  "projectDescription",
  "items",
  "subtotal",
  "discount",
  "discountType",
  "taxRate",
  "taxAmount",
  "totalAmount",
  "amountPaid",
  "balanceDue",
  "projectTotal",
  "previousPaid",
  "totalPaidTillDate",
  "remainingBalance",
  "invoiceDate",
  "dueDate",
  "paymentMethod",
  "paymentStatus",
  "status",
  "notes",
  "terms",
  "pdfUrl",
  "updatedAt",
];

const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

const toE164 = (value) => normalizeMobileNumber(value) || String(value).trim();

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      const unitPrice = Math.max(0, Number(item?.unitPrice) || 0);
      return {
        name: String(item?.name || "").trim().slice(0, 200),
        description: String(item?.description || "").trim().slice(0, 1000),
        quantity,
        unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
      };
    })
    .filter((item) => item.name);
};

/** Normalize an incoming invoice payload and recompute all money fields. */
const normalizePayload = (payload) => {
  const clean = { ...payload };
  if (clean.mobile) clean.mobile = toE164(clean.mobile);
  if (clean.items) clean.items = normalizeItems(clean.items);

  const finance = computeInvoiceFinance(
    clean.items || [],
    clean.discount,
    clean.discountType,
    clean.taxRate
  );
  clean.items = finance.items;
  clean.subtotal = finance.subtotal;
  clean.discountAmount = finance.discountAmount;
  clean.discount = finance.discount;
  clean.taxAmount = finance.taxAmount;
  clean.totalAmount = finance.totalAmount;

  if (clean.invoiceDate) clean.invoiceDate = new Date(clean.invoiceDate);
  if (clean.dueDate) clean.dueDate = new Date(clean.dueDate);
  return clean;
};

/** Duplicate prevention: one invoice per (quotation, type). */
const ensureNoDuplicate = async (quotationId, type, excludeId) => {
  if (!quotationId || !type) return;
  const filter = { quotationId, type };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Invoice.findOne(filter).select("invoiceNumber");
  if (existing) {
    throw ApiError.conflict(
      `An invoice of type "${type}" already exists for this quotation (${existing.invoiceNumber})`
    );
  }
};

const sendResultMessage = (result, channel) =>
  result.status === "success"
    ? `Invoice sent via ${channel}`
    : result.status === "fallback"
      ? "Invoice ready - WhatsApp Web opened (Cloud API not configured)"
      : result.status === "template"
        ? "Invoice template sent - the PDF and message will be delivered automatically when the client replies"
        : result.error
          ? `Invoice send failed: ${result.error}`
          : "Invoice send failed";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Load the approved quotation used as the project reference and derive the
 * running payment figures for the next invoice: project total (approved quote
 * total), previous payments (paid on earlier invoices), total paid till date,
 * remaining balance and how much can still be invoiced (project total minus
 * everything already invoiced, excluding `excludeId`).
 */
const getProjectReference = async ({ quotationId, excludeId }) => {
  if (!quotationId) return null;
  const quotation = await Quotation.findById(quotationId).lean();
  if (!quotation) return null;

  const projectTotal = round2(quotation.totalAmount);
  const others = await Invoice.find({
    quotationId,
    status: { $ne: "cancelled" },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("totalAmount amountPaid").lean();

  const previousPaid = round2(others.reduce((a, i) => a + (Number(i.amountPaid) || 0), 0));
  const invoicedOthers = round2(others.reduce((a, i) => a + (Number(i.totalAmount) || 0), 0));
  const totalPaidTillDate = previousPaid;
  const remainingBalance = Math.max(0, round2(projectTotal - totalPaidTillDate));
  const available = Math.max(0, round2(projectTotal - invoicedOthers));

  return { quotation, projectTotal, previousPaid, totalPaidTillDate, remainingBalance, invoicedOthers, available };
};

/** Block invoices whose amount would push total billing past the project total. */
const assertInvoiceWithinBalance = ({ projectTotal, available, totalAmount, quotationNumber }) => {
  if (!(projectTotal > 0)) return;
  const current = round2(totalAmount);
  if (current > available + 0.001) {
    throw ApiError.badRequest(
      `Invoice amount ${current} exceeds the remaining balance ${available} for quotation ${quotationNumber} (Project Total ${projectTotal} - already invoiced ${round2(projectTotal - available)})`
    );
  }
};

/** Build a single auto-computed line item when the admin leaves items blank. */
const suggestedInvoiceItem = (type, amount) => {
  const name = type === "advance"
    ? "Advance Payment"
    : type === "partial"
      ? "Milestone Payment"
      : type === "final"
        ? "Final Payment"
        : "Project Payment";
  const value = round2(amount);
  return { name, description: "", quantity: 1, unitPrice: value, amount: value };
};

/**
 * Attach the project reference to an invoice payload: set projectTotal,
 * auto-suggest the current amount (advance amount for an advance invoice,
 * otherwise the remaining that can still be invoiced) when the admin left no
 * line items, and refuse amounts that exceed the remaining balance.
 */
const attachProjectReference = async ({ payload, quotationId, excludeId }) => {
  const ref = await getProjectReference({ quotationId, excludeId });
  if (!ref) return ref;
  payload.projectTotal = ref.projectTotal;
  // Set the paid-based cumulative figures directly on the invoice at creation
  // time so Previous Payments is never 0 for a follow-up invoice - even if the
  // later refresh is skipped. Previous Payments / Remaining Balance always
  // come from PAID invoices only (ref.previousPaid sums amountPaid).
  payload.previousPaid = ref.previousPaid;
  payload.totalPaidTillDate = ref.totalPaidTillDate;
  payload.remainingBalance = ref.remainingBalance;

  if (!payload.items?.length && ref.projectTotal > 0) {
    const type = payload.type || "full";
    // Suggest the amount left to bill that is not already invoiced, capped by
    // the paid-based Remaining Balance so it always matches the formulas.
    const suggested = type === "advance" && Number(ref.quotation.advanceAmount) > 0
      ? Math.min(round2(ref.quotation.advanceAmount), ref.available)
      : Math.min(ref.remainingBalance, ref.available);
    payload.items = [suggestedInvoiceItem(type, suggested)];
    const finance = computeInvoiceFinance(payload.items, payload.discount, payload.discountType, payload.taxRate);
    payload.items = finance.items;
    payload.subtotal = finance.subtotal;
    payload.discountAmount = finance.discountAmount;
    payload.discount = finance.discount;
    payload.taxAmount = finance.taxAmount;
    payload.totalAmount = finance.totalAmount;
  }

  assertInvoiceWithinBalance({
    projectTotal: ref.projectTotal,
    available: ref.available,
    totalAmount: payload.totalAmount,
    quotationNumber: ref.quotation.quotationNumber,
  });
  return ref;
};

/** Refresh the cumulative project payment state, best effort. */
const syncProjectState = async (invoice) => {
  if (!invoice?.quotationId) return;
  try {
    await refreshProjectPaymentState({ quotationId: invoice.quotationId });
  } catch (err) {
    logger.warn(`[Invoice] project payment sync failed for ${invoice.invoiceNumber || invoice._id}: ${err.message}`);
  }
};

const persistSendResult = async ({ invoice, req, result, channel, isRetry = false, isReminder = false }) => {
  const ok = result.status === "success" || result.status === "fallback" || result.status === "template";
  if (ok && !invoice.sentAt) invoice.sentAt = new Date();
  if (channel === "whatsapp" && ok) invoice.status = "sent";
  await invoice.save();

  await InvoiceSendLog.create({
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    mobileNumber: channel === "whatsapp" ? invoice.mobile : "",
    email: channel === "email" ? invoice.email : "",
    channel,
    subject: channel === "email" ? `Invoice ${invoice.invoiceNumber}` : "",
    message: buildInvoiceMessage(invoice, { includePdfLink: result.status === "fallback" }),
    status: result.status,
    messageType: result.status === "template" ? "template" : result.documentMessageId ? "document" : "text",
    awaitingReply: result.status === "template",
    deliveryStatus: result.status === "success" || result.status === "template" ? "sent" : result.status === "failed" ? "failed" : "pending",
    sentAt: ok ? new Date() : null,
    waUrl: result.waUrl || "",
    pdfUrl: invoice.pdfUrl || "",
    providerMessageId: result.textMessageId || result.providerMessageId || "",
    documentMessageId: result.documentMessageId || "",
    templateMessageId: result.templateMessageId || "",
    error: result.error || "",
    isReminder,
    isRetry,
    sentBy: req.admin?._id || null,
    sentByName: req.admin?.name || "System",
  });

  auditLog(req, isRetry ? "resend" : isReminder ? "remind" : "send", "Invoice", invoice._id, `Invoice ${invoice.invoiceNumber} via ${channel} -> ${result.status}`);
  invalidateChartsCache();
};

const regeneratePdf = async (invoice) => ensureInvoicePdf(invoice, { force: true });

/** Log an "invoice created" activity on the linked lead's timeline. */
const syncLeadOnInvoiceCreated = async ({ invoice, req, note }) => {
  if (!invoice?.leadId) return;
  try {
    await recordLeadActivity({
      leadId: invoice.leadId,
      action: "invoice_created",
      title: `Invoice ${invoice.invoiceNumber} created`,
      note: note || `Invoice ${invoice.invoiceNumber} (${invoice.type}) created`,
      actor: PIPELINE_ACTOR(req),
    });
  } catch (err) {
    logger.warn(`[Invoice] pipeline log failed for ${invoice.invoiceNumber}: ${err.message}`);
  }
};

/**
 * Advance the linked lead after a payment lands, using the refreshed project
 * payment summary. A fully settled project moves the lead to "delivered";
 * otherwise the invoice type maps to the matching pipeline stage so the board
 * reflects real money received.
 */
const advanceLeadOnPayment = async ({ invoice, req, note }) => {
  if (!invoice?.leadId) return;
  try {
    const lead = await Lead.findById(invoice.leadId);
    if (!lead) return;
    const fullyPaid = Number(lead.projectTotal) > 0 && Number(lead.remainingBalance) <= 0;
    const newStage = fullyPaid
      ? "delivered"
      : { advance: "advance_received", final: "final_payment", full: "final_payment" }[invoice.type];
    if (!newStage) return;
    await moveLeadStage({
      lead,
      newStage,
      actor: PIPELINE_ACTOR(req),
      action: "payment_recorded",
      title: `Payment received - ${invoice.invoiceNumber}`,
      note: note || `Received ${invoice.totalAmount} against ${invoice.type} invoice ${invoice.invoiceNumber}`,
      forwardOnly: true,
    });
  } catch (err) {
    logger.warn(`[Invoice] pipeline sync on payment failed for ${invoice.invoiceNumber}: ${err.message}`);
  }
};

// ============================================================
// CRUD
// ============================================================

export const createInvoice = asyncHandler(async (req, res) => {
  const body = pick(req.body, [...INVOICE_KEYS, "quotationId"]);

  // Prefill client + project + line items from an approved quotation.
  if (body.quotationId) {
    const quotation = await Quotation.findById(body.quotationId).lean();
    if (!quotation) throw ApiError.notFound("Quotation not found");
    await ensureNoDuplicate(body.quotationId, body.type || "full", null);
    INVOICE_KEYS.forEach((key) => {
      // express-validator sanitizers may have written "" back for absent
      // fields, so treat empty/whitespace values as "not provided".
      if ((body[key] === undefined || body[key] === "" || body[key] === null) && quotation[key] !== undefined && quotation[key] !== "" && quotation[key] !== null) {
        body[key] = quotation[key];
      }
    });
    if ((body.items === undefined || body.items === "" || body.items === null) && Array.isArray(quotation.services)) {
      body.items = quotation.services.map((s) => ({
        name: s.name,
        description: s.description,
        quantity: 1,
        unitPrice: s.amount,
      }));
    }
    if ((!body.projectName || body.projectName === "") && quotation.projectName) body.projectName = quotation.projectName;
    body.quotationNumber = quotation.quotationNumber || "";
  } else if (body.quotationId === null || body.quotationId === "") {
    delete body.quotationId;
  }

  // Clear whitespace-only values injected by validator sanitizers so required
  // fields surface as a proper validation error instead of a mongoose error.
  ["clientName", "mobile", "projectName"].forEach((key) => {
    if (typeof body[key] === "string" && !body[key].trim()) delete body[key];
  });

  const payload = normalizePayload(body);
  payload.invoiceNumber = await generateInvoiceNumber();
  payload.status = "draft";
  payload.paymentStatus = "pending";
  payload.payments = [];
  Object.assign(payload, ACTOR(req));
  if (payload.quotationId) {
    await attachProjectReference({ payload, quotationId: payload.quotationId });
  }
  applyInvoicePaymentState(payload);

  const doc = await Invoice.create(payload);
  await syncProjectState(doc);
  await syncLeadOnInvoiceCreated({ invoice: doc, req });
  try {
    await regeneratePdf(doc);
  } catch (err) {
    logger.warn(`[Invoice] pdf generation failed for ${doc.invoiceNumber}: ${err.message}`);
  }
  auditLog(req, "create", "Invoice", doc._id, `Created invoice ${doc.invoiceNumber}`);
  invalidateChartsCache();
  return ApiResponse.created(res, "Invoice created", doc);
});

export const listInvoices = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  const { search, status, paymentStatus, type, from, to } = req.query;

  if (status && status !== "all") filter.status = status;
  if (paymentStatus && paymentStatus !== "all") filter.paymentStatus = paymentStatus;
  if (type && type !== "all") filter.type = type;

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
      { invoiceNumber: { $regex: term, $options: "i" } },
      { quotationNumber: { $regex: term, $options: "i" } },
    ];
  }

  let sort = { createdAt: -1 };
  const allowedSorts = ["createdAt", "updatedAt", "sentAt", "dueDate", "clientName", "businessName", "totalAmount", "invoiceNumber"];
  if (req.query.sort) {
    const [field, dir] = String(req.query.sort).split(":");
    if (allowedSorts.includes(field)) sort = { [field]: dir === "asc" ? 1 : -1 };
  }

  const [data, total] = await Promise.all([
    Invoice.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Invoice.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Invoices fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getInvoice = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound("Invoice not found");
  return ApiResponse.ok(res, "Invoice fetched", doc);
});

/**
 * GET /invoices/share/:id
 * Unauthenticated, sanitized view of a single invoice for the public client
 * page (/invoice/:id). Never exposes internal admin fields (createdBy,
 * payments/receivedBy, pdfPath) and hides cancelled invoices entirely.
 */
export const getPublicInvoice = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid invoice link");
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice || invoice.status === "cancelled") throw ApiError.notFound("Invoice not found");

  const out = {};
  PUBLIC_INVOICE_KEYS.forEach((key) => {
    if (invoice[key] !== undefined) out[key] = invoice[key];
  });
  return ApiResponse.ok(res, "Invoice fetched", out);
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Invoice not found");

  if (req.body.type && req.body.type !== doc.type) {
    await ensureNoDuplicate(doc.quotationId, req.body.type, doc._id);
  }

  const updates = normalizePayload(pick(req.body, INVOICE_KEYS));
  ["clientName", "mobile", "projectName"].forEach((key) => {
    if (typeof updates[key] === "string" && !updates[key].trim()) delete updates[key];
  });
  const changed = Object.keys(updates).filter((k) => updates[k] !== undefined);
  Object.assign(doc, updates);
  if (doc.quotationId) {
    await attachProjectReference({ payload: doc, quotationId: doc.quotationId, excludeId: doc._id });
  }
  applyInvoicePaymentState(doc);
  await doc.save();

  await syncProjectState(doc);

  if (changed.length) {
    try {
      await regeneratePdf(doc);
    } catch (err) {
      logger.warn(`[Invoice] pdf regen failed for ${doc.invoiceNumber}: ${err.message}`);
    }
  }

  auditLog(req, "update", "Invoice", doc._id, `Updated invoice ${doc.invoiceNumber}: ${changed.join(", ")}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Invoice updated", doc);
});

export const deleteInvoice = asyncHandler(async (req, res) => {
  const doc = await Invoice.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Invoice not found");
  await InvoiceSendLog.deleteMany({ invoiceId: doc._id });
  deleteInvoicePdf(doc.pdfPath);
  await syncProjectState(doc);
  auditLog(req, "delete", "Invoice", doc._id, `Deleted invoice ${doc.invoiceNumber}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Invoice deleted");
});

// ============================================================
// Send / resend / download
// ============================================================

/**
 * POST /invoices/send
 * Creates (or updates) an invoice, generates the PDF and sends it via WhatsApp
 * and/or email. Body may include `invoiceId` (existing record), `quotationId`
 * (prefill + duplicate guard) or none (blank). `channel`: whatsapp | email | both.
 */
export const sendInvoice = asyncHandler(async (req, res) => {
  let invoice = null;
  let isNewInvoice = false;
  const channel = req.body.channel === "email" ? "email" : req.body.channel === "both" ? "both" : "whatsapp";

  if (req.body.invoiceId) {
    invoice = await Invoice.findById(req.body.invoiceId);
    if (!invoice) throw ApiError.notFound("Invoice not found");
    const updates = normalizePayload(pick(req.body, INVOICE_KEYS));
    ["clientName", "mobile", "projectName"].forEach((key) => {
      if (typeof updates[key] === "string" && !updates[key].trim()) delete updates[key];
    });
    Object.assign(invoice, updates);
    if (invoice.quotationId) {
      await attachProjectReference({ payload: invoice, quotationId: invoice.quotationId, excludeId: invoice._id });
    }
    applyInvoicePaymentState(invoice);
    await invoice.save();
    await syncProjectState(invoice);
  } else {
    const body = pick(req.body, [...INVOICE_KEYS, "quotationId"]);
    if (body.quotationId) {
      const quotation = await Quotation.findById(body.quotationId).lean();
      if (!quotation) throw ApiError.notFound("Quotation not found");
      await ensureNoDuplicate(body.quotationId, body.type || "full", null);
      INVOICE_KEYS.forEach((key) => {
        if ((body[key] === undefined || body[key] === "" || body[key] === null) && quotation[key] !== undefined && quotation[key] !== "" && quotation[key] !== null) {
          body[key] = quotation[key];
        }
      });
      if ((body.items === undefined || body.items === "") && Array.isArray(quotation.services)) {
        body.items = quotation.services.map((s) => ({ name: s.name, description: s.description, quantity: 1, unitPrice: s.amount }));
      }
      if ((!body.projectName || body.projectName === "") && quotation.projectName) body.projectName = quotation.projectName;
      body.quotationNumber = quotation.quotationNumber || "";
    } else if (body.quotationId === null || body.quotationId === "") {
      delete body.quotationId;
    }
    ["clientName", "mobile", "projectName"].forEach((key) => {
      if (typeof body[key] === "string" && !body[key].trim()) delete body[key];
    });
    const payload = normalizePayload(body);
    payload.invoiceNumber = await generateInvoiceNumber();
    payload.status = "draft";
    payload.payments = [];
    Object.assign(payload, ACTOR(req));
    if (payload.quotationId) {
      await attachProjectReference({ payload, quotationId: payload.quotationId });
    }
    applyInvoicePaymentState(payload);
    invoice = await Invoice.create(payload);
    isNewInvoice = true;
    await syncProjectState(invoice);
  }

  let result = { status: "failed", error: "Unknown error while sending" };
  try {
    await regeneratePdf(invoice);

    if (channel === "whatsapp") {
      result = await sendInvoiceWhatsApp(invoice);
    } else if (channel === "email") {
      result = await sendInvoiceEmail(invoice);
    } else {
      const wa = await sendInvoiceWhatsApp(invoice);
      const mail = await sendInvoiceEmail(invoice);
      await persistSendResult({ invoice, req, result: wa, channel: "whatsapp" });
      await persistSendResult({ invoice, req, result: mail, channel: "email" });
      if (wa.status === "success" && mail.status === "success") result = { status: "success", error: "" };
      else if (wa.status === "success") result = { status: "success", channel: "whatsapp", error: `Email failed: ${mail.error}` };
      else if (mail.status === "success") result = { status: "success", channel: "email", error: `WhatsApp failed: ${wa.error}` };
      else result = { status: "failed", error: `WhatsApp: ${wa.error}; Email: ${mail.error}` };
    }
  } catch (err) {
    logger.error(`[Invoice] send failed for ${invoice.invoiceNumber}: ${err.message}`);
    result = { status: "failed", error: err.message || "PDF generation or send failed" };
  }
  if (channel !== "both") {
    await persistSendResult({ invoice, req, result, channel });
  }
  if (isNewInvoice) {
    await syncLeadOnInvoiceCreated({ invoice, req, note: `Invoice ${invoice.invoiceNumber} created & sent via ${channel}` });
  }

  return ApiResponse.ok(res, sendResultMessage(result, channel), {
    invoice: invoice.toObject(),
    status: result.status,
    channel,
    message: result.status === "failed"
      ? result.error
      : result.status === "template"
        ? sendResultMessage(result, channel)
        : buildInvoiceMessage(invoice, { includePdfLink: result.status === "fallback" }),
    waUrl: result.waUrl || "",
    pdfUrl: invoice.pdfUrl || "",
    templateMessageId: result.templateMessageId || "",
  });
});

export const resendInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");

  const channel = req.body.channel === "email" ? "email" : req.body.channel === "both" ? "both" : "whatsapp";
  let result = { status: "failed", error: "Unknown error while sending" };
  try {
    await regeneratePdf(invoice);
    if (channel === "whatsapp") {
      result = await sendInvoiceWhatsApp(invoice);
    } else if (channel === "email") {
      result = await sendInvoiceEmail(invoice);
    } else {
      const wa = await sendInvoiceWhatsApp(invoice);
      const mail = await sendInvoiceEmail(invoice);
      await persistSendResult({ invoice, req, result: wa, channel: "whatsapp", isRetry: true });
      await persistSendResult({ invoice, req, result: mail, channel: "email", isRetry: true });
      if (wa.status === "success" && mail.status === "success") result = { status: "success", error: "" };
      else if (wa.status === "success") result = { status: "success", channel: "whatsapp", error: `Email failed: ${mail.error}` };
      else if (mail.status === "success") result = { status: "success", channel: "email", error: `WhatsApp failed: ${wa.error}` };
      else result = { status: "failed", error: `WhatsApp: ${wa.error}; Email: ${mail.error}` };
    }
  } catch (err) {
    logger.error(`[Invoice] resend failed for ${invoice.invoiceNumber}: ${err.message}`);
    result = { status: "failed", error: err.message || "PDF generation or send failed" };
  }
  if (channel !== "both") {
    await persistSendResult({ invoice, req, result, channel, isRetry: true });
  }

  return ApiResponse.ok(res, sendResultMessage(result, channel), {
    invoice: invoice.toObject(),
    status: result.status,
    channel,
    message: result.status === "failed"
      ? result.error
      : result.status === "template"
        ? sendResultMessage(result, channel)
        : buildInvoiceMessage(invoice, { includePdfLink: result.status === "fallback" }),
    waUrl: result.waUrl || "",
    pdfUrl: invoice.pdfUrl || "",
    templateMessageId: result.templateMessageId || "",
  });
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");

  await ensureInvoicePdf(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(invoice.pdfPath).pipe(res);
});

// ============================================================
// Payments
// ============================================================

export const recordInvoicePayment = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status === "cancelled") throw ApiError.badRequest("Cannot record payment on a cancelled invoice");

  const amount = Math.round(Math.max(0, Number(req.body.amount) || 0) * 100) / 100;
  if (amount <= 0) throw ApiError.badRequest("Payment amount must be greater than zero");
  if (amount > Number(invoice.balanceDue) + 0.001) {
    throw ApiError.badRequest(`Amount exceeds the balance due (${invoice.balanceDue})`);
  }

  invoice.payments.push({
    amount,
    method: req.body.method || invoice.paymentMethod || "bank_transfer",
    reference: String(req.body.reference || "").trim().slice(0, 200),
    paidOn: req.body.paidOn ? new Date(req.body.paidOn) : new Date(),
    note: String(req.body.note || "").trim().slice(0, 1000),
    receivedBy: req.admin?._id || null,
    receivedByName: req.admin?.name || "System",
  });
  applyInvoicePaymentState(invoice);
  await invoice.save();

  await syncProjectState(invoice);

  try {
    await regeneratePdf(invoice);
  } catch (err) {
    logger.warn(`[Invoice] pdf regen after payment failed for ${invoice.invoiceNumber}: ${err.message}`);
  }

  await advanceLeadOnPayment({ invoice, req, note: `Payment of ${amount} received against ${invoice.invoiceNumber}` });
  auditLog(req, "payment", "Invoice", invoice._id, `Payment of ${amount} recorded on ${invoice.invoiceNumber} (status: ${invoice.paymentStatus})`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Payment recorded", invoice);
});

export const markInvoicePaid = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status === "cancelled") throw ApiError.badRequest("Cannot mark a cancelled invoice as paid");

  const remaining = Math.round((Number(invoice.balanceDue) - 0.001) * 100) / 100;
  if (remaining > 0) {
    invoice.payments.push({
      amount: Number(invoice.balanceDue),
      method: req.body.method || invoice.paymentMethod || "bank_transfer",
      reference: String(req.body.reference || "").trim().slice(0, 200),
      paidOn: new Date(),
      note: "Marked as paid",
      receivedBy: req.admin?._id || null,
      receivedByName: req.admin?.name || "System",
    });
  }
  applyInvoicePaymentState(invoice);
  await invoice.save();

  await syncProjectState(invoice);

  try {
    await regeneratePdf(invoice);
  } catch (err) {
    logger.warn(`[Invoice] pdf regen on mark-paid failed for ${invoice.invoiceNumber}: ${err.message}`);
  }

  await advanceLeadOnPayment({ invoice, req, note: `Invoice ${invoice.invoiceNumber} marked as paid` });
  auditLog(req, "payment", "Invoice", invoice._id, `Invoice ${invoice.invoiceNumber} marked as paid`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Invoice marked as paid", invoice);
});

export const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  invoice.status = "cancelled";
  invoice.cancelledAt = new Date();
  await invoice.save();
  await syncProjectState(invoice);
  auditLog(req, "update", "Invoice", invoice._id, `Invoice ${invoice.invoiceNumber} cancelled`);
  invalidateChartsCache();
  return ApiResponse.ok(res, "Invoice cancelled", invoice);
});

// ============================================================
// Stats, prefill, overdue, logs
// ============================================================

export const getInvoiceStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, draft, sent, paid, cancelled, partial, pending, overdue, createdToday, monthly, totalValue, paidValue, outstandingValue, overdueValue] = await Promise.all([
    Invoice.countDocuments(),
    Invoice.countDocuments({ status: "draft" }),
    Invoice.countDocuments({ status: "sent" }),
    Invoice.countDocuments({ status: "paid" }),
    Invoice.countDocuments({ status: "cancelled" }),
    Invoice.countDocuments({ paymentStatus: "partial" }),
    Invoice.countDocuments({ paymentStatus: "pending", status: "sent" }),
    Invoice.countDocuments({ paymentStatus: "overdue", status: "sent" }),
    Invoice.countDocuments({ createdAt: { $gte: todayStart } }),
    Invoice.countDocuments({ createdAt: { $gte: monthStart } }),
    Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]).then((r) => r[0]?.total || 0),
    Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$amountPaid" } } }]).then((r) => r[0]?.total || 0),
    Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$balanceDue" } } }]).then((r) => r[0]?.total || 0),
    Invoice.aggregate([{ $match: { paymentStatus: "overdue", status: "sent" } }, { $group: { _id: null, total: { $sum: "$balanceDue" } } }]).then((r) => r[0]?.total || 0),
  ]);

  return ApiResponse.ok(res, "Invoice stats", {
    total,
    draft,
    sent,
    paid,
    cancelled,
    partial,
    pending,
    overdue,
    createdToday,
    monthly,
    totalValue,
    paidValue,
    outstandingValue,
    overdueValue,
  });
});

/** GET /invoices/prefill/:quotationId - quotation snapshot + existing invoices + suggested type + payment summary. */
export const getInvoicePrefill = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).lean();
  if (!quotation) throw ApiError.notFound("Quotation not found");

  const existing = await Invoice.find({ quotationId: quotation._id }).sort({ createdAt: -1 }).lean();
  const usedTypes = new Set(existing.map((inv) => inv.type));
  const suggestedTypes = ["advance", "partial", "final", "full"].filter((t) => !usedTypes.has(t));

  const active = existing.filter((inv) => inv.status !== "cancelled");
  const projectTotal = round2(quotation.totalAmount);
  const previousPaid = round2(active.reduce((a, inv) => a + (Number(inv.amountPaid) || 0), 0));
  const totalPaidTillDate = previousPaid;
  const remainingBalance = Math.max(0, round2(projectTotal - totalPaidTillDate));
  const invoiced = round2(active.reduce((a, inv) => a + (Number(inv.totalAmount) || 0), 0));
  const availableForInvoice = Math.max(0, round2(projectTotal - invoiced));

  return ApiResponse.ok(res, "Invoice prefill fetched", {
    quotation,
    existing,
    suggestedTypes,
    summary: {
      projectTotal,
      previousPaid,
      totalPaidTillDate,
      remainingBalance,
      invoiced,
      availableForInvoice,
    },
  });
});

/** GET /invoices/overdue - sent invoices past due with an outstanding balance. */
export const listOverdueInvoices = asyncHandler(async (req, res) => {
  const now = new Date();
  const filter = {
    status: "sent",
    dueDate: { $ne: null, $lt: now },
    balanceDue: { $gt: 0 },
  };
  const data = await Invoice.find(filter).sort({ dueDate: 1 }).lean();
  return ApiResponse.ok(res, "Overdue invoices fetched", data);
});

/** POST /invoices/overdue/remind - send a reminder to every overdue invoice. */
export const sendOverdueReminders = asyncHandler(async (req, res) => {
  const now = new Date();
  const overdue = await Invoice.find({
    status: "sent",
    dueDate: { $ne: null, $lt: now },
    balanceDue: { $gt: 0 },
  });

  if (!overdue.length) {
    return ApiResponse.ok(res, "No overdue invoices to remind", { reminded: 0, total: 0, results: [] });
  }

  const results = [];
  for (const invoice of overdue) {
    let result;
    try {
      await regeneratePdf(invoice);
      const channel = req.body.channel === "email" ? "email" : "whatsapp";
      result = channel === "email" ? await sendInvoiceEmail(invoice) : await sendInvoiceWhatsApp(invoice);
      await persistSendResult({ invoice, req, result, channel, isReminder: true });
    } catch (err) {
      logger.error(`[Invoice] reminder failed for ${invoice.invoiceNumber}: ${err.message}`);
      result = { status: "failed", error: err.message };
    }
    results.push({ invoiceNumber: invoice.invoiceNumber, status: result.status, error: result.error || "" });
  }

  const reminded = results.filter((r) => r.status === "success").length;
  return ApiResponse.ok(res, `Reminders sent to ${reminded} of ${overdue.length} overdue invoices`, {
    reminded,
    total: overdue.length,
    results,
  });
});

export const getInvoiceSendLogs = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid invoice id");
  const invoice = await Invoice.exists({ _id: req.params.id });
  if (!invoice) throw ApiError.notFound("Invoice not found");

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    InvoiceSendLog.find({ invoiceId: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    InvoiceSendLog.countDocuments({ invoiceId: req.params.id }),
  ]);

  return ApiResponse.ok(res, "Invoice send logs fetched", data, getPaginationMeta(pageNum, limitNum, total));
});
