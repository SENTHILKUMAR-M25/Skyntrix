import fs from "fs";
import mongoose from "mongoose";
import Receipt from "../models/Receipt.model.js";
import ReceiptSendLog from "../models/ReceiptSendLog.model.js";
import Invoice from "../models/Invoice.model.js";
import Quotation from "../models/Quotation.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse, { getPaginationMeta } from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { auditLog } from "../middleware/audit.middleware.js";
import logger from "../utils/logger.js";
import { normalizeMobileNumber } from "../services/whatsapp.service.js";
import {
  generateReceiptNumber,
  generateReceiptPdf,
  ensureReceiptPdf,
  deleteReceiptPdf,
  computeProjectPaymentLedger,
  findLedgerTarget,
  buildReceiptMessage,
  sendReceiptWhatsApp,
  sendReceiptEmail,
  syncProjectState,
  getReceiptHistory,
} from "../services/receipt.service.js";
import { invalidateChartsCache } from "./dashboard.controller.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const sendResultMessage = (result, channel) =>
  result.status === "success"
    ? `Receipt sent via ${channel}`
    : result.status === "fallback"
      ? "Receipt ready - WhatsApp Web opened (Cloud API not configured)"
      : result.status === "template"
        ? "Receipt template sent - the PDF and message will be delivered automatically when the client replies"
        : result.error
          ? `Receipt send failed: ${result.error}`
          : "Receipt send failed";

/**
 * Resolve which invoice payment this receipt certifies. Prefers an explicit
 * paymentEntryId; falls back to the invoice's most recent payment; finally a
 * synthetic snapshot from the invoice itself (marked-paid without a ledger
 * entry). Returns { payment, paymentEntryId, paymentKey }.
 */
const resolvePayment = async (invoice, { paymentEntryId, method, reference, paidOn }) => {
  const payments = invoice.payments || [];
  let payment = null;

  if (paymentEntryId) {
    payment = payments.find((p) => String(p._id) === String(paymentEntryId));
    if (!payment) throw ApiError.notFound("Payment entry not found on this invoice");
  } else if (payments.length) {
    payment = payments[payments.length - 1];
  }

  if (payment) {
    const amount = round2(payment.amount);
    return {
      payment,
      paymentEntryId: payment._id || null,
      paymentKey: "",
      amount,
      method: method || payment.method || "bank_transfer",
      reference: reference !== undefined && reference !== "" ? String(reference).trim() : String(payment.reference || "").trim(),
      paidOn: paidOn ? new Date(paidOn) : new Date(payment.paidOn || payment.createdAt || new Date()),
      note: String(payment.note || "").trim(),
    };
  }

  // Synthetic snapshot: invoice was paid without an explicit ledger entry.
  const amount = round2(invoice.amountPaid || invoice.totalAmount || 0);
  if (amount <= 0) throw ApiError.badRequest("No payment amount available to receipt");
  const paidTimestamp = (paidOn && new Date(paidOn).getTime()) || (invoice.paidAt && new Date(invoice.paidAt).getTime()) || Date.now();
  const m = method || invoice.paymentMethod || "bank_transfer";
  const ref = String(reference || "").trim();
  return {
    payment: null,
    paymentEntryId: null,
    paymentKey: `${invoice._id}:${amount}:${m}:${ref}:${paidTimestamp}`,
    amount,
    method: m,
    reference: ref,
    paidOn: new Date(paidTimestamp),
    note: String(invoice.notes || "").trim(),
  };
};

// ============================================================
// Generate
// ============================================================

/**
 * POST /receipts/generate
 * Generate a payment receipt for a paid invoice. A receipt can only be issued
 * after the invoice has been marked Paid. On success the invoice stays Paid,
 * the project payment summary + outstanding balance are refreshed and the PDF
 * is stored with the receipt record.
 */
export const generateReceipt = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.body.invoiceId);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status === "cancelled") throw ApiError.badRequest("Cannot generate a receipt for a cancelled invoice");
  if (invoice.paymentStatus !== "paid") {
    throw ApiError.badRequest("A payment receipt can only be generated after the invoice is marked as Paid");
  }

  const quotation = invoice.quotationId
    ? await Quotation.findById(invoice.quotationId).lean()
    : null;
  if (!quotation) throw ApiError.badRequest("This invoice is not linked to a quotation; receipts require a project reference");

  const resolved = await resolvePayment(invoice, req.body);

  // Duplicate prevention: a receipt already exists for this transaction.
  if (resolved.paymentEntryId) {
    const existing = await Receipt.findOne({ invoiceId: invoice._id, paymentEntryId: resolved.paymentEntryId }).select("receiptNumber");
    if (existing) {
      throw ApiError.conflict(`A receipt already exists for this payment transaction (${existing.receiptNumber})`);
    }
  } else if (resolved.paymentKey) {
    const existing = await Receipt.findOne({ invoiceId: invoice._id, paymentKey: resolved.paymentKey }).select("receiptNumber");
    if (existing) {
      throw ApiError.conflict(`A receipt already exists for this payment transaction (${existing.receiptNumber})`);
    }
  }

  // Per-payment cumulative project figures.
  const ledger = await computeProjectPaymentLedger({ quotationId: invoice.quotationId });
  const target = findLedgerTarget({ ledger, invoiceId: invoice._id, paymentEntryId: resolved.paymentEntryId });
  const previousPaid = target ? target.previousPaid : round2(Math.max(0, round2(invoice.totalPaidTillDate || 0) - resolved.amount));
  const totalPaidTillDate = round2(previousPaid + resolved.amount);
  const projectTotal = round2((ledger && ledger.projectTotal) || quotation.totalAmount);
  const remainingBalance = Math.max(0, round2(projectTotal - totalPaidTillDate));

  const receiptNumber = await generateReceiptNumber();

  const doc = await Receipt.create({
    receiptNumber,
    invoiceId: invoice._id,
    quotationId: invoice.quotationId || null,
    leadId: invoice.leadId || null,
    paymentEntryId: resolved.paymentEntryId,
    paymentKey: resolved.paymentKey,
    invoiceNumber: invoice.invoiceNumber || "",
    quotationNumber: invoice.quotationNumber || quotation.quotationNumber || "",

    clientName: invoice.clientName,
    businessName: invoice.businessName || "",
    mobile: invoice.mobile || "",
    email: invoice.email || "",
    billingAddress: invoice.billingAddress || "",
    gstin: invoice.gstin || "",

    projectName: invoice.projectName,
    projectDescription: invoice.projectDescription || "",

    projectTotal,
    invoiceAmount: round2(invoice.totalAmount),
    previousPayments: previousPaid,
    amountReceived: resolved.amount,
    totalPaidTillDate,
    remainingBalance,
    amountPaidOnInvoice: round2(invoice.amountPaid),
    balanceDueOnInvoice: round2(invoice.balanceDue),

    paymentMethod: resolved.method,
    transactionId: resolved.reference,
    note: resolved.note,
    paidOn: resolved.paidOn,
    paymentStatus: "paid",

    generatedBy: req.admin?._id || null,
    generatedByName: req.admin?.name || "System",
  });

  try {
    await generateReceiptPdf(doc);
  } catch (err) {
    logger.warn(`[Receipt] pdf generation failed for ${doc.receiptNumber}: ${err.message}`);
  }

  // Keep the invoice Paid, refresh every invoice's cumulative summary and the
  // linked lead's totalPaid / remainingBalance / paymentStatus.
  await syncProjectState({ quotationId: invoice.quotationId, leadId: invoice.leadId });

  auditLog(req, "generate", "Receipt", doc._id, `Generated receipt ${doc.receiptNumber} for invoice ${invoice.invoiceNumber} (${doc.amountReceived})`);
  invalidateChartsCache();
  return ApiResponse.created(res, `Receipt ${doc.receiptNumber} generated`, doc);
});

// ============================================================
// CRUD / list
// ============================================================

export const listReceipts = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  const { search, invoiceId, quotationId, leadId, from, to } = req.query;

  if (invoiceId) filter.invoiceId = invoiceId;
  if (quotationId) filter.quotationId = quotationId;
  if (leadId) filter.leadId = leadId;

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
      { receiptNumber: { $regex: term, $options: "i" } },
      { invoiceNumber: { $regex: term, $options: "i" } },
      { quotationNumber: { $regex: term, $options: "i" } },
      { transactionId: { $regex: term, $options: "i" } },
    ];
  }

  let sort = { createdAt: -1 };
  const allowedSorts = ["createdAt", "updatedAt", "paidOn", "clientName", "amountReceived", "receiptNumber"];
  if (req.query.sort) {
    const [field, dir] = String(req.query.sort).split(":");
    if (allowedSorts.includes(field)) sort = { [field]: dir === "asc" ? 1 : -1 };
  }

  const [data, total] = await Promise.all([
    Receipt.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Receipt.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Receipts fetched", data, getPaginationMeta(pageNum, limitNum, total));
});

export const getReceipt = asyncHandler(async (req, res) => {
  const doc = await Receipt.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound("Receipt not found");
  return ApiResponse.ok(res, "Receipt fetched", doc);
});

/** GET /receipts/history?quotationId=..|leadId=.. - full receipt history for a project. */
export const listReceiptHistory = asyncHandler(async (req, res) => {
  const { quotationId, leadId } = req.query;
  if (!quotationId && !leadId) throw ApiError.badRequest("Provide quotationId or leadId");
  const history = await getReceiptHistory({ quotationId, leadId });
  return ApiResponse.ok(res, "Receipt history fetched", history);
});

/** GET /receipts/stats - summary figures for the receipts dashboard. */
export const getReceiptStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, monthCount, totalReceived, monthReceived, generatedToday, issuedInvoices] = await Promise.all([
    Receipt.countDocuments(),
    Receipt.countDocuments({ createdAt: { $gte: monthStart } }),
    Receipt.aggregate([{ $group: { _id: null, total: { $sum: "$amountReceived" } } }]).then((r) => r[0]?.total || 0),
    Receipt.aggregate([{ $match: { createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amountReceived" } } }]).then((r) => r[0]?.total || 0),
    Receipt.countDocuments({ createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }),
    Receipt.aggregate([{ $group: { _id: "$invoiceId" } }, { $count: "n" }]).then((r) => r[0]?.n || 0),
  ]);

  return ApiResponse.ok(res, "Receipt stats", {
    total,
    monthCount,
    totalReceived,
    monthReceived,
    generatedToday,
    issuedInvoices,
  });
});

// ============================================================
// Download / regenerate / resend / logs
// ============================================================

export const downloadReceipt = asyncHandler(async (req, res) => {
  const doc = await Receipt.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Receipt not found");

  await ensureReceiptPdf(doc);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${doc.receiptNumber}.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(doc.pdfPath).pipe(res);
});

/**
 * POST /receipts/:id/regenerate
 * Re-fetch the linked invoice + quotation, recompute the cumulative payment
 * figures for the receipt's payment transaction and regenerate the PDF. Keeps
 * the same receipt number and preserves the audit trail.
 */
export const regenerateReceipt = asyncHandler(async (req, res) => {
  const doc = await Receipt.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Receipt not found");

  const invoice = await Invoice.findById(doc.invoiceId);
  if (!invoice) throw ApiError.notFound("Linked invoice not found");
  if (invoice.status === "cancelled") throw ApiError.badRequest("Cannot regenerate a receipt for a cancelled invoice");

  // Refresh cumulative figures from the current payment ledger.
  const ledger = await computeProjectPaymentLedger({ quotationId: invoice.quotationId });
  const target = findLedgerTarget({ ledger, invoiceId: invoice._id, paymentEntryId: doc.paymentEntryId });
  const projectTotal = round2((ledger && ledger.projectTotal) || doc.projectTotal);
  let previousPaid = doc.previousPayments;
  let totalPaidTillDate = doc.totalPaidTillDate;
  let remainingBalance = doc.remainingBalance;
  if (target) {
    previousPaid = target.previousPaid;
    totalPaidTillDate = target.totalPaidTillDate;
    remainingBalance = target.remainingBalance;
  }

  // Refresh snapshots from the current invoice.
  doc.invoiceNumber = invoice.invoiceNumber || doc.invoiceNumber;
  doc.clientName = invoice.clientName || doc.clientName;
  doc.businessName = invoice.businessName || doc.businessName;
  doc.mobile = invoice.mobile || doc.mobile;
  doc.email = invoice.email || doc.email;
  doc.billingAddress = invoice.billingAddress || doc.billingAddress;
  doc.gstin = invoice.gstin || doc.gstin;
  doc.projectName = invoice.projectName || doc.projectName;
  doc.projectDescription = invoice.projectDescription || doc.projectDescription;
  doc.invoiceAmount = round2(invoice.totalAmount);
  doc.amountPaidOnInvoice = round2(invoice.amountPaid);
  doc.balanceDueOnInvoice = round2(invoice.balanceDue);

  if (ledger) {
    doc.projectTotal = projectTotal;
    doc.previousPayments = previousPaid;
    doc.totalPaidTillDate = totalPaidTillDate;
    doc.remainingBalance = remainingBalance;
  }

  doc.regeneratedAt = new Date();
  doc.regenerationCount = (doc.regenerationCount || 0) + 1;

  try {
    await generateReceiptPdf(doc);
  } catch (err) {
    logger.warn(`[Receipt] regen pdf failed for ${doc.receiptNumber}: ${err.message}`);
  }
  await doc.save();

  await syncProjectState({ quotationId: invoice.quotationId, leadId: invoice.leadId });

  auditLog(req, "regenerate", "Receipt", doc._id, `Regenerated receipt ${doc.receiptNumber}`);
  invalidateChartsCache();
  return ApiResponse.ok(res, `Receipt ${doc.receiptNumber} regenerated`, doc);
});

const persistSendResult = async ({ receipt, req, result, channel, isRetry = false }) => {
  const ok = result.status === "success" || result.status === "fallback" || result.status === "template";
  if (ok) receipt.resentCount = (receipt.resentCount || 0) + 1;
  if (ok) receipt.sentAt = new Date();
  await receipt.save();

  await ReceiptSendLog.create({
    receiptId: receipt._id,
    receiptNumber: receipt.receiptNumber,
    invoiceNumber: receipt.invoiceNumber,
    clientName: receipt.clientName,
    mobileNumber: channel === "whatsapp" ? receipt.mobile : "",
    email: channel === "email" ? receipt.email : "",
    channel,
    subject: channel === "email" ? `Payment Receipt ${receipt.receiptNumber}` : "",
    message: buildReceiptMessage(receipt, { includePdfLink: result.status === "fallback" }),
    status: result.status,
    messageType: result.status === "template" ? "template" : result.documentMessageId ? "document" : "text",
    awaitingReply: result.status === "template",
    deliveryStatus: result.status === "success" || result.status === "template" ? "sent" : result.status === "failed" ? "failed" : "pending",
    sentAt: ok ? new Date() : null,
    waUrl: result.waUrl || "",
    pdfUrl: receipt.pdfUrl || "",
    providerMessageId: result.textMessageId || result.providerMessageId || "",
    documentMessageId: result.documentMessageId || "",
    templateMessageId: result.templateMessageId || "",
    error: result.error || "",
    isRetry,
    sentBy: req.admin?._id || null,
    sentByName: req.admin?.name || "System",
  });

  auditLog(req, "resend", "Receipt", receipt._id, `Receipt ${receipt.receiptNumber} via ${channel} -> ${result.status}`);
  invalidateChartsCache();
};

export const resendReceipt = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) throw ApiError.notFound("Receipt not found");

  const channel = req.body.channel === "email" ? "email" : req.body.channel === "both" ? "both" : "whatsapp";
  let result = { status: "failed", error: "Unknown error while sending" };
  try {
    await ensureReceiptPdf(receipt, { force: true });
    if (channel === "whatsapp") {
      result = await sendReceiptWhatsApp(receipt);
    } else if (channel === "email") {
      result = await sendReceiptEmail(receipt);
    } else {
      const wa = await sendReceiptWhatsApp(receipt);
      const mail = await sendReceiptEmail(receipt);
      await persistSendResult({ receipt, req, result: wa, channel: "whatsapp", isRetry: true });
      await persistSendResult({ receipt, req, result: mail, channel: "email", isRetry: true });
      if (wa.status === "success" && mail.status === "success") result = { status: "success", error: "" };
      else if (wa.status === "success") result = { status: "success", channel: "whatsapp", error: `Email failed: ${mail.error}` };
      else if (mail.status === "success") result = { status: "success", channel: "email", error: `WhatsApp failed: ${wa.error}` };
      else result = { status: "failed", error: `WhatsApp: ${wa.error}; Email: ${mail.error}` };
    }
  } catch (err) {
    logger.error(`[Receipt] resend failed for ${receipt.receiptNumber}: ${err.message}`);
    result = { status: "failed", error: err.message || "PDF generation or send failed" };
  }
  if (channel !== "both") {
    await persistSendResult({ receipt, req, result, channel, isRetry: true });
  }

  return ApiResponse.ok(res, sendResultMessage(result, channel), {
    receipt: receipt.toObject(),
    status: result.status,
    channel,
    message: result.status === "failed"
      ? result.error
      : result.status === "template"
        ? sendResultMessage(result, channel)
        : buildReceiptMessage(receipt, { includePdfLink: result.status === "fallback" }),
    waUrl: result.waUrl || "",
    pdfUrl: receipt.pdfUrl || "",
    templateMessageId: result.templateMessageId || "",
  });
});

export const getReceiptSendLogs = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid receipt id");
  const receipt = await Receipt.exists({ _id: req.params.id });
  if (!receipt) throw ApiError.notFound("Receipt not found");

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    ReceiptSendLog.find({ receiptId: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    ReceiptSendLog.countDocuments({ receiptId: req.params.id }),
  ]);

  return ApiResponse.ok(res, "Receipt send logs fetched", data, getPaginationMeta(pageNum, limitNum, total));
});
