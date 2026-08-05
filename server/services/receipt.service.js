import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { env } from "../config/env.js";
import { nextSequence } from "../models/Counter.model.js";
import Receipt from "../models/Receipt.model.js";
import Invoice from "../models/Invoice.model.js";
import Quotation from "../models/Quotation.model.js";
import Lead from "../models/Lead.model.js";
import { sendMail } from "./mailer.service.js";
import {
  COMPANY,
  formatMoney,
  formatDate,
  LOGO_PATH,
} from "./quotation.service.js";
import {
  normalizeMobileNumber,
  buildWaMeUrl,
  sendWhatsAppMessage,
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
  isWhatsAppConfigured,
  isActiveConversation,
  markConversationOutbound,
  isPubliclyReachableUrl,
  SESSION_ENDED_ERROR,
} from "./whatsapp.service.js";
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RECEIPTS_DIR = path.join(__dirname, "..", "uploads", "receipts");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---------------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------------

/**
 * Auto-generate a unique receipt number, e.g. RCT-2026-0001, using the same
 * atomic counter the invoice/quotation modules use so concurrent requests can
 * never collide. The unique index on receiptNumber is the final safety net.
 */
export const generateReceiptNumber = async () => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seq = await nextSequence(`receipt-${year}`);
    const number = `RCT-${year}-${String(seq).padStart(4, "0")}`;
    const exists = await Receipt.exists({ receiptNumber: number });
    if (!exists) return number;
    logger.warn(`[Receipt] number collision on ${number}, retrying...`);
  }
  throw new Error("Could not generate a unique receipt number");
};

// ---------------------------------------------------------------------------
// Payment ledger (per-payment cumulative project figures)
// ---------------------------------------------------------------------------

/**
 * Build the project payment ledger: every payment recorded across all active
 * invoices of a quotation, ordered by when it was paid, with running cumulative
 * figures. Each entry carries previousPaid, totalPaidTillDate and
 * remainingBalance so a receipt for ANY individual payment always reflects the
 * true cumulative state of the project at that point in time.
 */
export const computeProjectPaymentLedger = async ({ quotationId, leadId, excludeInvoiceId } = {}) => {
  let quotation = null;
  if (quotationId) {
    quotation = await Quotation.findById(quotationId).lean();
  } else if (leadId) {
    quotation = await Quotation.findOne({ leadId, approved: true }).sort({ createdAt: -1 }).lean();
  }
  if (!quotation) return null;

  const projectTotal = round2(quotation.totalAmount);
  const filter = { status: { $ne: "cancelled" } };
  if (quotationId) filter.quotationId = quotationId;
  else if (leadId) filter.leadId = leadId;
  if (excludeInvoiceId) filter._id = { $ne: excludeInvoiceId };

  const invoices = await Invoice.find(filter).sort({ createdAt: 1 }).lean();

  const entries = [];
  for (const invoice of invoices) {
    for (const payment of invoice.payments || []) {
      entries.push({ invoice, payment });
    }
  }

  // Stable chronological order: paidOn first, then subdocument id for ties.
  entries.sort((a, b) => {
    const ta = new Date(a.payment.paidOn || a.payment.createdAt || 0).getTime();
    const tb = new Date(b.payment.paidOn || b.payment.createdAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.payment._id || "").localeCompare(String(b.payment._id || ""));
  });

  let running = 0;
  const rows = entries.map(({ invoice, payment }) => {
    const amount = round2(payment.amount);
    const previousPaid = running;
    running = round2(running + amount);
    return {
      invoice,
      payment,
      amount,
      previousPaid,
      totalPaidTillDate: running,
      remainingBalance: Math.max(0, round2(projectTotal - running)),
    };
  });

  return {
    quotation,
    projectTotal,
    rows,
    totalPaidTillDate: running,
    remainingBalance: Math.max(0, round2(projectTotal - running)),
  };
};

/**
 * Locate the ledger row that matches the receipt target. Prefers an explicit
 * paymentEntryId; otherwise the most recent payment of the given invoice.
 */
export const findLedgerTarget = ({ ledger, invoiceId, paymentEntryId }) => {
  if (!ledger) return null;
  if (paymentEntryId) {
    const target = ledger.rows.find(
      (row) => String(row.payment._id) === String(paymentEntryId) && String(row.invoice._id) === String(invoiceId)
    );
    if (target) return target;
  }
  const matches = ledger.rows.filter((row) => String(row.invoice._id) === String(invoiceId));
  return matches.length ? matches[matches.length - 1] : null;
};

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 45;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  ink: "#0B1120",
  primary: "#6D28D9",
  muted: "#6B7280",
  border: "#E5E7EB",
  light: "#F8FAFC",
  white: "#FFFFFF",
  softPurple: "#EDE9FE",
  label: "#9CA3AF",
  success: "#059669",
  danger: "#DC2626",
};

const SECTION_TITLE_HEIGHT = 30;
const SIGNATURE_HEIGHT = 96;
const SECTION_GAP = 10;

const ensureSpace = (doc, height) => {
  if (doc.y + height > doc.page.maxY()) {
    doc.addPage();
  }
};

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, SECTION_TITLE_HEIGHT);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.ink).text(title.toUpperCase(), MARGIN, y, { width: CONTENT_WIDTH });
  doc.rect(MARGIN, y + 13, 26, 2.5).fillColor(COLORS.primary).fill();
  doc.moveTo(MARGIN, y + 19.5).lineTo(PAGE_WIDTH - MARGIN, y + 19.5).lineWidth(0.7).strokeColor(COLORS.border).stroke();
  doc.y = y + SECTION_TITLE_HEIGHT;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatMobileDisplay = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return String(value || "—");
};

const drawHeader = (doc, receipt) => {
  doc.rect(0, 0, PAGE_WIDTH, 116).fillColor(COLORS.ink).fill();
  doc.rect(0, 116, PAGE_WIDTH, 4).fillColor(COLORS.primary).fill();

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, 30, { width: 54, height: 54 });
    }
  } catch (err) {
    logger.warn(`[Receipt] logo render skipped: ${err.message}`);
  }

  doc.font("Helvetica-Bold").fontSize(17).fillColor(COLORS.white).text(COMPANY.name, 118, 34, { width: 240 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#C4B5FD").text(COMPANY.tagline, 118, 58, { width: 240 });

  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.white).text("PAYMENT RECEIPT", 340, 26, { width: 210, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#E9D5FF").text(`No: ${receipt.receiptNumber}`, 340, 52, { width: 210, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor("#A5B4FC").text(`Date: ${formatDate(receipt.paidOn)}`, 340, 68, { width: 210, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor("#A5B4FC").text(`Time: ${formatDateTime(receipt.paidOn).split(",")[1] || ""}`, 340, 83, { width: 210, align: "right" });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#34D399")
    .text(`Status: ${String(receipt.paymentStatus || "paid").toUpperCase()}`, 340, 98, { width: 210, align: "right" });
};

const drawInfoCard = (doc, receipt) => {
  const titleH = 28;
  const rowH = 16;
  const rowCount = 5;
  const padY = 12;
  const cardH = titleH + rowCount * rowH + padY;
  ensureSpace(doc, cardH + SECTION_GAP);
  const y = doc.y;
  const colGap = 14;
  const colW = (CONTENT_WIDTH - colGap) / 2;
  const leftX = MARGIN + 14;
  const rightX = MARGIN + colW + colGap + 14;
  const labelW = 74;
  const valueW = colW - labelW - 14;

  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 6).fillColor(COLORS.light).fill();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 6).lineWidth(0.8).strokeColor(COLORS.border).stroke();

  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primary);
  doc.text("CLIENT DETAILS", leftX, y + 10);
  doc.text("RECEIPT DETAILS", rightX, y + 10);

  const rows = [
    [["CLIENT", receipt.clientName], ["RECEIPT NO", receipt.receiptNumber]],
    [["BUSINESS", receipt.businessName], ["INVOICE NO", receipt.invoiceNumber || "—"]],
    [["MOBILE", formatMobileDisplay(receipt.mobile)], ["QUOTATION NO", receipt.quotationNumber || "—"]],
    [["EMAIL", receipt.email], ["PAYMENT DATE", formatDate(receipt.paidOn)]],
    [["ADDRESS", receipt.billingAddress], ["PAYMENT METHOD", String(receipt.paymentMethod || "—").toUpperCase().replace(/_/g, " ")]],
  ];

  rows.forEach((pair, i) => {
    const ry = y + titleH + i * rowH;
    pair.forEach(([label, value], col) => {
      const x = col === 0 ? leftX : rightX;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.label).text(label, x, ry, { width: labelW, lineBreak: false });
      doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink).text(String(value || "—"), x + labelW, ry, { width: valueW, lineBreak: false, ellipsis: true });
    });
  });

  doc.y = y + cardH + SECTION_GAP;
};

const drawProject = (doc, receipt) => {
  const desc = (receipt.projectDescription || "").trim();
  const nameH = 15;
  const descH = desc ? doc.font("Helvetica").fontSize(9).heightOfString(desc, { width: CONTENT_WIDTH }) : 0;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + nameH + descH + SECTION_GAP);
  drawSectionTitle(doc, "Project");
  const y0 = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(receipt.projectName, MARGIN, y0, { width: CONTENT_WIDTH });
  if (desc) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(desc, MARGIN, y0 + 15, { width: CONTENT_WIDTH, lineGap: 2 });
    doc.y = y0 + 15 + descH + SECTION_GAP;
  } else {
    doc.y = y0 + nameH + SECTION_GAP;
  }
};

const drawAmountReceived = (doc, receipt) => {
  const boxH = 62;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + boxH + SECTION_GAP);
  drawSectionTitle(doc, "Amount Received");
  const y = doc.y;

  doc.rect(MARGIN, y, CONTENT_WIDTH, boxH).fillColor(COLORS.ink).fill();
  doc.rect(MARGIN, y, CONTENT_WIDTH, 3).fillColor(COLORS.primary).fill();

  doc.font("Helvetica").fontSize(9).fillColor("#C4B5FD").text("We confirm receipt of the following amount", MARGIN + 18, y + 14, { width: CONTENT_WIDTH - 36 });
  doc.font("Helvetica-Bold").fontSize(26).fillColor(COLORS.white)
    .text(formatMoney(receipt.amountReceived), MARGIN + 18, y + 28, { width: CONTENT_WIDTH - 36 });

  doc.font("Helvetica").fontSize(9).fillColor("#A5B4FC")
    .text(`Transaction ID / UTR: ${receipt.transactionId || "—"}`, MARGIN + 18, y + boxH - 20, { width: CONTENT_WIDTH - 36, align: "right" });

  doc.y = y + boxH + SECTION_GAP;
};

const drawPaymentSummary = (doc, receipt) => {
  const boxW = 290;
  const boxX = MARGIN + CONTENT_WIDTH - boxW;
  const rowH = 17;
  const rows = [
    ["Project Total", formatMoney(receipt.projectTotal), COLORS.ink],
    ["Invoice Amount", formatMoney(receipt.invoiceAmount), COLORS.ink],
    ["Previous Payments", formatMoney(receipt.previousPayments || 0), COLORS.ink],
    ["Amount Received", formatMoney(receipt.amountReceived), COLORS.primary],
    ["Total Paid Till Date", formatMoney(receipt.totalPaidTillDate || 0), COLORS.success],
    ["Remaining Balance", formatMoney(receipt.remainingBalance || 0), Number(receipt.remainingBalance) > 0 ? COLORS.danger : COLORS.success],
  ];
  const totalH = rows.length * rowH + 20;

  ensureSpace(doc, SECTION_TITLE_HEIGHT + totalH + SECTION_GAP);
  drawSectionTitle(doc, "Payment Summary");
  const y0 = doc.y;

  rows.forEach(([label, value, color], i) => {
    const ry = y0 + i * rowH;
    const isReceived = i === 3;
    if (isReceived) {
      doc.rect(boxX - 8, ry - 2, boxW + 8, rowH + 2).fillColor(COLORS.softPurple).fill();
    }
    doc.font(isReceived ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(COLORS.muted)
      .text(label, boxX, ry + 3, { width: boxW - 130 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(color)
      .text(value, boxX + (boxW - 130), ry + 3, { width: 120, align: "right" });
  });

  const invoiceY = y0 + rows.length * rowH + 14;
  doc.rect(boxX - 8, invoiceY, boxW + 8, 24).fillColor(COLORS.light).fill();
  doc.rect(boxX - 8, invoiceY, boxW + 8, 24).lineWidth(0.8).strokeColor(COLORS.border).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text("Paid on this invoice", boxX, invoiceY + 7, { width: boxW - 130 });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text(formatMoney(receipt.amountPaidOnInvoice || 0), boxX + (boxW - 130), invoiceY + 6, { width: 120, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text("Balance due on invoice", boxX, invoiceY + 14, { width: boxW - 130 });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(receipt.balanceDueOnInvoice > 0 ? COLORS.danger : COLORS.success)
    .text(formatMoney(receipt.balanceDueOnInvoice || 0), boxX + (boxW - 130), invoiceY + 13, { width: 120, align: "right" });

  doc.y = invoiceY + 24 + SECTION_GAP;
};

const drawPaymentDetails = (doc, receipt) => {
  const rows = [
    ["Payment Method", String(receipt.paymentMethod || "other").toUpperCase().replace(/_/g, " ")],
    ["Transaction ID / UTR", receipt.transactionId || "—"],
    ["Payment Date", formatDate(receipt.paidOn)],
    ["Payment Time", formatDateTime(receipt.paidOn).split(",")[1] || "—"],
    ["Payment Status", String(receipt.paymentStatus || "paid").toUpperCase()],
  ];
  const rowH = 17;
  const totalH = rows.length * rowH + 8;

  ensureSpace(doc, SECTION_TITLE_HEIGHT + totalH + SECTION_GAP);
  drawSectionTitle(doc, "Payment Details");
  const y0 = doc.y;

  rows.forEach(([label, value], i) => {
    const ry = y0 + i * rowH;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.label).text(label, MARGIN, ry + 3, { width: 170 });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink).text(String(value || "—"), MARGIN + 170, ry + 3, { width: CONTENT_WIDTH - 170 });
  });
  doc.y = y0 + totalH + SECTION_GAP;
};

const drawNotes = (doc, receipt) => {
  const note = (receipt.note || "").trim();
  if (!note) return;
  const noteH = doc.font("Helvetica").fontSize(8.5).heightOfString(note, { width: CONTENT_WIDTH }) + 16;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + noteH);
  drawSectionTitle(doc, "Notes");
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(note, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
  doc.y += noteH;
};

const drawSealPlaceholder = (doc, x, y) => {
  const r = 22;
  doc.circle(x + r, y + r, r).lineWidth(1).dash(3, 3).strokeColor(COLORS.primary).stroke();
  doc.lineWidth(0).undash();
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(COLORS.primary).text("COMPANY SEAL", x + 6, y + r - 4, { width: 32, align: "center" });
};

const drawSignature = (doc, receipt) => {
  const y = doc.y;
  const rightX = PAGE_WIDTH - MARGIN - 190;
  const rightW = 190;

  // Authorized signature on the right.
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text("For Skyntrix Technologies", rightX, y);
  doc.moveTo(rightX, y + 32).lineTo(rightX + rightW, y + 32).lineWidth(1).strokeColor(COLORS.ink).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(COMPANY.founder, rightX, y + 38);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(COMPANY.founderTitle, rightX, y + 52);

  // Company seal placeholder on the left.
  drawSealPlaceholder(doc, MARGIN, y);
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.label).text("Received by", MARGIN + 60, y + 12, { width: 120 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(receipt.generatedByName || "System", MARGIN + 60, y + 24, { width: 120 });

  doc.y = y + SIGNATURE_HEIGHT;
};

const drawFooter = (doc, pageIndex, totalPages) => {
  const y = PAGE_HEIGHT - 52;
  doc.rect(0, y - 12, PAGE_WIDTH, 46).fillColor("#111827").fill();
  doc.rect(0, y - 12, PAGE_WIDTH, 3).fillColor(COLORS.primary).fill();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#E5E7EB").text(COMPANY.name, MARGIN, y, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor("#9CA3AF").text(COMPANY.address, MARGIN, y + 11, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor("#D1D5DB").text(`${COMPANY.website}  |  ${COMPANY.email}  |  ${COMPANY.phone}`, MARGIN, y + 22, { lineBreak: false });
  const pageLabel = `Page ${pageIndex} of ${totalPages}`;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#9CA3AF").text(pageLabel, PAGE_WIDTH - MARGIN - doc.widthOfString(pageLabel), y + 22, { lineBreak: false });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a branded A4 payment receipt PDF and write it to uploads/receipts
 * using an atomic temp-file + rename so a reader can never observe a partial
 * file.
 * @returns {{ path: string, url: string, filename: string }}
 */
export const generateReceiptPdf = async (receipt) => {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  const filename = `${receipt.receiptNumber}.pdf`;
  const filePath = path.join(RECEIPTS_DIR, filename);
  const fileUrl = `${String(env.uploadUrl).replace(/\/+$/, "")}/uploads/receipts/${filename}`;

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: { top: 40, left: MARGIN, right: MARGIN, bottom: 90 }, bufferPages: true });
      const stream = fs.createWriteStream(tmpPath);

      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      doc.pipe(stream);
      drawHeader(doc, receipt);
      doc.y = 148;

      drawInfoCard(doc, receipt);
      drawProject(doc, receipt);
      drawAmountReceived(doc, receipt);
      drawPaymentSummary(doc, receipt);
      drawPaymentDetails(doc, receipt);
      drawNotes(doc, receipt);

      ensureSpace(doc, SIGNATURE_HEIGHT);
      drawSignature(doc, receipt);

      const { count: totalPages } = doc.bufferedPageRange();
      for (let i = 0; i < totalPages; i += 1) {
        doc.switchToPage(i);
        drawFooter(doc, i + 1, totalPages);
      }
      doc.switchToPage(totalPages - 1);

      doc.end();
    });

    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
    throw err;
  }

  logger.info(`[Receipt] PDF generated: ${filePath}`);
  return { path: filePath, url: fileUrl, filename };
};

/** Make sure a current PDF exists for the receipt, optionally forcing a regen. */
export const ensureReceiptPdf = async (receipt, { force = false } = {}) => {
  if (!force && receipt.pdfPath && fs.existsSync(receipt.pdfPath)) {
    return receipt;
  }
  const pdf = await generateReceiptPdf(receipt);
  receipt.pdfUrl = pdf.url;
  receipt.pdfPath = pdf.path;
  await receipt.save();
  return receipt;
};

/** Remove the receipt PDF file from disk (best effort). */
export const deleteReceiptPdf = (pdfPath) => {
  if (!pdfPath) return;
  try {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  } catch (err) {
    logger.warn(`[Receipt] could not delete PDF ${pdfPath}: ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// WhatsApp / email messaging
// ---------------------------------------------------------------------------

export const buildReceiptMessage = (receipt, { includePdfLink = false } = {}) => {
  const name = (receipt.clientName || "").trim() || "there";
  const amount = Number(receipt.amountReceived || 0).toLocaleString("en-IN");
  const paidTill = Number(receipt.totalPaidTillDate || 0).toLocaleString("en-IN");
  const balance = Number(receipt.remainingBalance || 0).toLocaleString("en-IN");
  const project = (receipt.projectName || "").trim() || "\u2014";
  const lines = [
    `Hello ${name},`,
    "",
    "Thank you for choosing Skyntrix Technologies.",
    "",
    "We confirm receipt of your payment. Please find your payment receipt attached.",
    "",
    `Receipt No: ${receipt.receiptNumber || "\u2014"}`,
    `Invoice No: ${receipt.invoiceNumber || "\u2014"}`,
    `Project: ${project}`,
    `Amount Received: \u20B9${amount}`,
    `Total Paid Till Date: \u20B9${paidTill}`,
    `Remaining Balance: \u20B9${balance}`,
    `Payment Date: ${formatDate(receipt.paidOn)}`,
  ];
  if (includePdfLink && isPubliclyReachableUrl(receipt.pdfUrl)) {
    lines.push("", `Download PDF: ${receipt.pdfUrl}`);
  }
  lines.push(
    "",
    "If you have any questions regarding this receipt, feel free to contact us.",
    "",
    "Regards,",
    "Senthil Kumar",
    "Founder",
    "Skyntrix Technologies"
  );
  return lines.join("\n");
};

export const buildReceiptDocumentCaption = (receipt) => {
  const amount = Number(receipt.amountReceived || 0).toLocaleString("en-IN");
  const balance = Number(receipt.remainingBalance || 0).toLocaleString("en-IN");
  const project = (receipt.projectName || "").trim() || "\u2014";
  return [
    "Payment receipt attached.",
    "",
    `Receipt No: ${receipt.receiptNumber || "\u2014"}`,
    `Project: ${project}`,
    `Amount Received: \u20B9${amount}`,
    `Remaining Balance: \u20B9${balance}`,
  ].join("\n");
};

/** Params for the pre-approved receipt template ({{1}} name, {{2}} no, {{3}} project, {{4}} amount). */
export const buildReceiptTemplateParams = (receipt) => {
  const amount = Number(receipt.amountReceived || 0).toLocaleString("en-IN");
  return [
    (receipt.clientName || "").trim() || "there",
    receipt.receiptNumber || "-",
    (receipt.projectName || "").trim() || "-",
    `\u20B9${amount}`,
  ];
};

/**
 * Send the receipt PDF followed by the personalized text message (document
 * first so the client never gets a "please find attached" note when the PDF
 * failed).
 */
export const sendReceiptFollowUp = async (receipt) => {
  const digits = normalizeMobileNumber(receipt.mobile);
  if (!digits) {
    return { status: "failed", textMessageId: "", documentMessageId: "", error: "Invalid mobile number", errorCode: 0 };
  }
  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, buildReceiptMessage(receipt, { includePdfLink: true }));
    return { status: "fallback", textMessageId: "", documentMessageId: "", waUrl, error: "", errorCode: 0 };
  }

  const doc = await sendWhatsAppDocument({
    to: digits,
    filePath: receipt.pdfPath || "",
    link: isPubliclyReachableUrl(receipt.pdfUrl) ? receipt.pdfUrl : "",
    caption: buildReceiptDocumentCaption(receipt),
    filename: `Receipt - ${receipt.receiptNumber}.pdf`,
  });

  if (doc.status !== "success") {
    const error = doc.error || "WhatsApp PDF document send failed";
    logger.error(`[Receipt] document send failed for ${digits}: ${error}`);
    return { status: "failed", textMessageId: "", documentMessageId: "", error, errorCode: doc.errorCode || 0 };
  }

  const text = await sendWhatsAppMessage({
    to: digits,
    body: buildReceiptMessage(receipt, { includePdfLink: false }),
  });
  if (text.status === "failed") {
    logger.error(`[Receipt] text message failed for ${digits}: ${text.error}`);
    return { status: "failed", textMessageId: "", documentMessageId: doc.providerMessageId || "", error: text.error || "WhatsApp text message failed", errorCode: text.errorCode || 0 };
  }

  logger.info(`[Receipt] document + text sent to ${digits}`);
  return {
    status: "success",
    textMessageId: text.providerMessageId || "",
    documentMessageId: doc.providerMessageId || "",
    error: "",
    errorCode: 0,
  };
};

/**
 * Send the receipt to the client's WhatsApp number, fully automated. Mirrors
 * the invoice flow: free-form PDF + text when the 24h window is open, a
 * pre-approved template to open the conversation otherwise, and a wa.me link as
 * the final fallback.
 */
export const sendReceiptWhatsApp = async (receipt) => {
  const digits = normalizeMobileNumber(receipt.mobile);
  if (!digits) {
    return { status: "failed", textMessageId: "", documentMessageId: "", templateMessageId: "", error: "Invalid mobile number", errorCode: 0 };
  }

  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, buildReceiptMessage(receipt, { includePdfLink: true }));
    logger.info(`[Receipt] Cloud API unavailable - fallback link for ${digits}`);
    return { status: "fallback", textMessageId: "", documentMessageId: "", templateMessageId: "", waUrl, error: "", errorCode: 0 };
  }

  if (await isActiveConversation(digits)) {
    logger.info(`[Receipt] active session for ${digits} - sending free-form PDF + text`);
    const followUp = await sendReceiptFollowUp(receipt);
    return { ...followUp, templateMessageId: "" };
  }

  const followUp = await sendReceiptFollowUp(receipt);
  if (followUp.status === "success") {
    return { ...followUp, templateMessageId: "" };
  }

  if (followUp.errorCode === SESSION_ENDED_ERROR) {
    logger.info(`[Receipt] no open session for ${digits} - initiating via template`);
    const template = await sendWhatsAppTemplate({
      to: digits,
      templateName: env.whatsapp.receiptTemplateName,
      language: env.whatsapp.receiptTemplateLang,
      bodyParams: buildReceiptTemplateParams(receipt),
    });

    if (template.status === "success") {
      await markConversationOutbound(digits, template.providerMessageId);
      return {
        status: "template",
        textMessageId: "",
        documentMessageId: "",
        templateMessageId: template.providerMessageId || "",
        error: "",
        errorCode: 0,
      };
    }

    logger.error(`[Receipt] template initiation failed for ${digits}: ${template.error}`);
    return {
      status: "failed",
      textMessageId: "",
      documentMessageId: "",
      templateMessageId: "",
      error: template.error || "WhatsApp template send failed",
      errorCode: template.errorCode || 0,
    };
  }

  return { ...followUp, templateMessageId: "" };
};

const escHtml = (value) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Branded HTML receipt for email delivery (with the PDF attached). */
export const buildReceiptEmailHtml = (receipt) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#0B1120">
    <div style="background:#0B1120;color:#fff;padding:22px 28px;border-radius:8px 8px 0 0">
      <div style="font-size:18px;font-weight:700">Skyntrix Technologies</div>
      <div style="color:#C4B5FD;font-size:12px">Building Digital Experiences That Drive Growth</div>
      <div style="margin-top:10px;font-size:20px;font-weight:800;letter-spacing:1px">PAYMENT RECEIPT</div>
      <div style="color:#A5B4FC;font-size:12px">No: ${escHtml(receipt.receiptNumber)} &nbsp;|&nbsp; Date: ${formatDate(receipt.paidOn)} &nbsp;|&nbsp; Status: PAID</div>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:0;padding:22px 28px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          <td style="width:50%;vertical-align:top">
            <div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px">RECEIVED FROM</div>
            <div style="font-weight:700">${escHtml(receipt.clientName)}</div>
            <div style="color:#6B7280;font-size:12px">${escHtml(receipt.businessName)}<br/>${escHtml(receipt.billingAddress)}<br/>${escHtml(receipt.mobile)}<br/>${escHtml(receipt.email)}</div>
          </td>
          <td style="vertical-align:top;text-align:right">
            <div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px">PROJECT</div>
            <div style="font-weight:700">${escHtml(receipt.projectName)}</div>
            <div style="color:#6B7280;font-size:12px">Invoice: ${escHtml(receipt.invoiceNumber)}<br/>Quotation: ${escHtml(receipt.quotationNumber)}</div>
          </td>
        </tr>
      </table>
      <div style="background:#0B1120;color:#fff;border-radius:8px;padding:16px 20px;margin-bottom:16px">
        <div style="color:#C4B5FD;font-size:11px;font-weight:700">AMOUNT RECEIVED</div>
        <div style="font-size:26px;font-weight:800">${formatMoney(receipt.amountReceived)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Project Total</td><td style="text-align:right;padding:3px 8px;width:130px">${formatMoney(receipt.projectTotal)}</td></tr>
        <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Invoice Amount</td><td style="text-align:right;padding:3px 8px">${formatMoney(receipt.invoiceAmount)}</td></tr>
        <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Previous Payments</td><td style="text-align:right;padding:3px 8px">${formatMoney(receipt.previousPayments)}</td></tr>
        <tr style="background:#EDE9FE;font-weight:800"><td style="padding:6px 8px;text-align:right">Amount Received</td><td style="padding:6px 8px;text-align:right;color:#6D28D9">${formatMoney(receipt.amountReceived)}</td></tr>
        <tr><td style="text-align:right;color:#059669;font-weight:700;padding:3px 8px">Total Paid Till Date</td><td style="text-align:right;padding:3px 8px;color:#059669;font-weight:700">${formatMoney(receipt.totalPaidTillDate)}</td></tr>
        <tr><td style="text-align:right;font-weight:700;padding:3px 8px">Remaining Balance</td><td style="text-align:right;font-weight:700;padding:3px 8px;color:${Number(receipt.remainingBalance) > 0 ? "#DC2626" : "#059669"}">${formatMoney(receipt.remainingBalance)}</td></tr>
      </table>
      <table style="width:100%;margin-top:16px;font-size:13px;border-top:1px solid #E5E7EB">
        <tr><td style="padding:3px 8px;color:#6B7280;width:180px">Payment Method</td><td style="padding:3px 8px;font-weight:600">${escHtml(String(receipt.paymentMethod || "other").replace(/_/g, " "))}</td></tr>
        <tr><td style="padding:3px 8px;color:#6B7280">Transaction ID / UTR</td><td style="padding:3px 8px;font-weight:600">${escHtml(receipt.transactionId || "—")}</td></tr>
        <tr><td style="padding:3px 8px;color:#6B7280">Payment Date &amp; Time</td><td style="padding:3px 8px;font-weight:600">${escHtml(receipt.paidOn ? formatDate(receipt.paidOn) : "—")}</td></tr>
        <tr><td style="padding:3px 8px;color:#6B7280">Payment Status</td><td style="padding:3px 8px;font-weight:600;color:#059669">PAID</td></tr>
      </table>
      ${receipt.note ? `<p style="color:#6B7280;font-size:12px;margin-top:14px">${escHtml(receipt.note)}</p>` : ""}
      <p style="border-top:1px solid #E5E7EB;padding-top:12px;font-size:12px;color:#6B7280">This is a computer-generated payment receipt from Skyntrix Technologies.</p>
      <p style="text-align:right;margin-top:18px;font-size:13px">For Skyntrix Technologies<br/><strong>Senthil Kumar</strong><br/><span style="color:#6B7280">Founder</span></p>
    </div>
    <div style="background:#111827;color:#9CA3AF;font-size:12px;padding:14px 28px;border-radius:0 0 8px 8px">
      ${escHtml(COMPANY.website)} | ${escHtml(COMPANY.email)} | ${escHtml(COMPANY.phone)}
    </div>
  </div>`;

export const buildReceiptEmailSubject = (receipt) => `Payment Receipt ${receipt.receiptNumber} - ${receipt.clientName} - ${formatMoney(receipt.amountReceived)}`;

/** Email the receipt PDF to the client's address. Returns a result object. */
export const sendReceiptEmail = async (receipt) => {
  if (!receipt.email) {
    return { status: "failed", channel: "email", error: "No client email address", errorCode: 0 };
  }
  try {
    await sendMail({
      to: receipt.email,
      subject: buildReceiptEmailSubject(receipt),
      html: buildReceiptEmailHtml(receipt),
      text: buildReceiptMessage(receipt, { includePdfLink: isPubliclyReachableUrl(receipt.pdfUrl) }),
      attachments: [{ filename: `Payment Receipt - ${receipt.receiptNumber}.pdf`, path: receipt.pdfPath }],
    });
    logger.info(`[Receipt] email sent to ${receipt.email}`);
    return { status: "success", channel: "email", error: "", errorCode: 0 };
  } catch (err) {
    logger.error(`[Receipt] email send failed for ${receipt.receiptNumber}: ${err.message}`);
    return { status: "failed", channel: "email", error: err.message || "Email send failed", errorCode: 0 };
  }
};

/**
 * Refresh the cumulative project payment state after a receipt is generated so
 * the invoice status stays Paid, every invoice's running summary is correct and
 * the linked lead's totalPaid/remainingBalance stay in sync.
 */
export const syncProjectState = async ({ quotationId, leadId }) => {
  try {
    const { refreshProjectPaymentState } = await import("./invoice.service.js");
    await refreshProjectPaymentState({ quotationId, leadId });
  } catch (err) {
    logger.warn(`[Receipt] project payment sync failed: ${err.message}`);
  }
};

/**
 * Gather every receipt for a project (by quotation or lead), newest first, for
 * the receipt history panel.
 */
export const getReceiptHistory = async ({ quotationId, leadId } = {}) => {
  const filter = {};
  if (quotationId) filter.quotationId = quotationId;
  if (leadId) filter.leadId = leadId;
  if (!Object.keys(filter).length) return [];
  return Receipt.find(filter).sort({ createdAt: -1 }).lean();
};
