import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { env } from "../config/env.js";
import { nextSequence } from "../models/Counter.model.js";
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

export const INVOICES_DIR = path.join(__dirname, "..", "uploads", "invoices");

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
  warning: "#D97706",
  danger: "#DC2626",
};

const SECTION_TITLE_HEIGHT = 30;
const SIGNATURE_HEIGHT = 72;
const SECTION_GAP = 10;

const INVOICE_TERMS = [
  "Payment is due on or before the due date mentioned above.",
  "A late payment fee of 1.5% per month may be applied on overdue balances.",
  "Please quote the invoice number as the payment reference when transferring.",
  "Ownership of the final deliverables transfers to the client upon full settlement.",
];

// ---------------------------------------------------------------------------
// Numbering & finance
// ---------------------------------------------------------------------------

/**
 * Auto-generate a unique invoice number, e.g. INV-2026-0001, using the atomic
 * counter so concurrent requests can never collide. The unique index on
 * invoiceNumber is the final safety net.
 */
export const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seq = await nextSequence(`invoice-${year}`);
    const number = `INV-${year}-${String(seq).padStart(4, "0")}`;
    const exists = await Invoice.exists({ invoiceNumber: number });
    if (!exists) return number;
    logger.warn(`[Invoice] number collision on ${number}, retrying...`);
  }
  throw new Error("Could not generate a unique invoice number");
};

/**
 * Derive item amounts and the subtotal/discount/tax/total figures from the raw
 * editable inputs. Mutates the given items (normalizing `amount`) and returns
 * the computed finance block.
 */
export const computeInvoiceFinance = (items = [], discount = 0, discountType = "flat", taxRate = 0) => {
  const normalized = items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    return { ...item, quantity, unitPrice, amount: Math.round(quantity * unitPrice * 100) / 100 };
  });

  const subtotal = Math.round(normalized.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const discountAmount = Math.round((discountType === "percent" ? (subtotal * Number(discount)) / 100 : Number(discount)) * 100) / 100;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((taxable * Number(taxRate)) / 100 * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;

  return { items: normalized, subtotal, discountAmount, discount: Number(discount), taxAmount, totalAmount };
};

/**
 * Recompute the running payment state from the payments ledger: amount paid,
 * balance due, paymentStatus and the lifecycle status/paidAt. Called after every
 * financial change so stored fields always match the ledger.
 */
export const applyInvoicePaymentState = (invoice, { now = new Date() } = {}) => {
  const amountPaid = Math.round((invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
  const totalAmount = Number(invoice.totalAmount) || 0;
  const balanceDue = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

  invoice.amountPaid = amountPaid;
  invoice.balanceDue = balanceDue;

  let paymentStatus = "pending";
  if (amountPaid >= totalAmount && totalAmount > 0) paymentStatus = "paid";
  else if (amountPaid > 0) paymentStatus = "partial";
  else if (invoice.status === "sent" && invoice.dueDate && new Date(invoice.dueDate) < now) paymentStatus = "overdue";
  invoice.paymentStatus = paymentStatus;

  if (paymentStatus === "paid") {
    invoice.status = "paid";
    invoice.paidAt = invoice.paidAt || now;
  }

  return invoice;
};

// ---------------------------------------------------------------------------
// Cumulative project payment tracking
// ---------------------------------------------------------------------------

/**
 * Given every active invoice of a quotation (oldest first) and the approved
 * project total, derive each invoice's running cumulative figures:
 * previous paid, total paid till date and remaining project balance.
 */
export const computeProjectPaymentSummary = (invoices = [], projectTotal = 0) => {
  const roundedTotal = Math.round((Number(projectTotal) || 0) * 100) / 100;
  const ordered = [...invoices].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  let previousPaid = 0;
  const rows = [];
  for (const invoice of ordered) {
    const amountPaid = Math.round((Number(invoice.amountPaid) || 0) * 100) / 100;
    const totalPaidTillDate = Math.round((previousPaid + amountPaid) * 100) / 100;
    const remainingBalance = Math.max(0, Math.round((roundedTotal - totalPaidTillDate) * 100) / 100);
    rows.push({ invoice, projectTotal: roundedTotal, previousPaid, totalPaidTillDate, remainingBalance });
    previousPaid = totalPaidTillDate;
  }
  return rows;
};

/**
 * Recompute and persist the cumulative payment state for every invoice of a
 * quotation (reference = the quotation's total amount) and mirror the running
 * summary onto the linked lead. Called after quotation approval and after every
 * invoice create/update/cancel/delete/payment so balances are always derived
 * from the paid ledger, never hand-entered.
 */
export const refreshProjectPaymentState = async ({ quotationId, leadId } = {}) => {
  let quotation = null;
  if (quotationId) {
    quotation = await Quotation.findById(quotationId);
  } else if (leadId) {
    quotation = await Quotation.findOne({ leadId, approved: true }).sort({ createdAt: -1 });
  }
  if (!quotation) return null;

  const projectTotal = Math.round((Number(quotation.totalAmount) || 0) * 100) / 100;
  const invoices = await Invoice.find({
    quotationId: quotation._id,
    status: { $ne: "cancelled" },
  }).sort({ createdAt: 1 });

  const rows = computeProjectPaymentSummary(invoices, projectTotal);
  for (const row of rows) {
    const { invoice, previousPaid, totalPaidTillDate, remainingBalance } = row;
    if (
      invoice.projectTotal !== projectTotal ||
      invoice.previousPaid !== previousPaid ||
      invoice.totalPaidTillDate !== totalPaidTillDate ||
      invoice.remainingBalance !== remainingBalance
    ) {
      invoice.projectTotal = projectTotal;
      invoice.previousPaid = previousPaid;
      invoice.totalPaidTillDate = totalPaidTillDate;
      invoice.remainingBalance = remainingBalance;
      await invoice.save();
    }
  }

  const leadTotalPaid = rows.length ? rows[rows.length - 1].totalPaidTillDate : 0;
  if (quotation.leadId) {
    const lead = await Lead.findById(quotation.leadId);
    if (lead) {
      const remainingBalance = Math.max(0, Math.round((projectTotal - leadTotalPaid) * 100) / 100);
      const paymentStatus = projectTotal > 0 && leadTotalPaid >= projectTotal ? "paid" : leadTotalPaid > 0 ? "partial" : "pending";
      if (
        lead.projectTotal !== projectTotal ||
        lead.totalPaid !== leadTotalPaid ||
        lead.remainingBalance !== remainingBalance ||
        lead.paymentStatus !== paymentStatus
      ) {
        lead.projectTotal = projectTotal;
        lead.totalPaid = leadTotalPaid;
        lead.remainingBalance = remainingBalance;
        lead.paymentStatus = paymentStatus;
        await lead.save();
      }
    }
  }

  return { projectTotal, leadTotalPaid, remainingBalance: Math.max(0, projectTotal - leadTotalPaid) };
};

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

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

const drawHeader = (doc, invoice) => {
  doc.rect(0, 0, PAGE_WIDTH, 116).fillColor(COLORS.ink).fill();
  doc.rect(0, 116, PAGE_WIDTH, 4).fillColor(COLORS.primary).fill();

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, 30, { width: 54, height: 54 });
    }
  } catch (err) {
    logger.warn(`[Invoice] logo render skipped: ${err.message}`);
  }

  doc.font("Helvetica-Bold").fontSize(17).fillColor(COLORS.white).text(COMPANY.name, 118, 34, { width: 240 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#C4B5FD").text(COMPANY.tagline, 118, 58, { width: 240 });

  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.white).text("INVOICE", 340, 26, { width: 210, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#E9D5FF").text(`No: ${invoice.invoiceNumber}`, 340, 52, { width: 210, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor("#A5B4FC").text(`Date: ${formatDate(invoice.invoiceDate)}`, 340, 68, { width: 210, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor("#A5B4FC").text(`Due Date: ${formatDate(invoice.dueDate)}`, 340, 83, { width: 210, align: "right" });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(invoice.paymentStatus === "paid" ? "#34D399" : invoice.paymentStatus === "overdue" ? "#FCA5A5" : "#FDE68A")
    .text(`Status: ${String(invoice.paymentStatus || "pending").toUpperCase()}`, 340, 98, { width: 210, align: "right" });
};

const formatMobileDisplay = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return String(value || "—");
};

const drawInfoCard = (doc, invoice) => {
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
  const labelW = 70;
  const valueW = colW - labelW - 14;

  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 6).fillColor(COLORS.light).fill();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 6).lineWidth(0.8).strokeColor(COLORS.border).stroke();

  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primary);
  doc.text("BILL TO", leftX, y + 10);
  doc.text("INVOICE DETAILS", rightX, y + 10);

  const rows = [
    [["CLIENT", invoice.clientName], ["PROJECT", invoice.projectName]],
    [["BUSINESS", invoice.businessName], ["TYPE", String(invoice.type || "full").toUpperCase()]],
    [["MOBILE", formatMobileDisplay(invoice.mobile)], ["QUOTATION", invoice.quotationNumber || "—"]],
    [["EMAIL", invoice.email], ["PAYMENT METHOD", String(invoice.paymentMethod || "—").toUpperCase().replace(/_/g, " ")]],
    [["ADDRESS", invoice.billingAddress], ["GSTIN", invoice.gstin || "—"]],
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

const drawProject = (doc, invoice) => {
  const desc = (invoice.projectDescription || "").trim();
  const nameH = 15;
  const descH = desc ? doc.font("Helvetica").fontSize(9).heightOfString(desc, { width: CONTENT_WIDTH }) : 0;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + nameH + descH + SECTION_GAP);
  drawSectionTitle(doc, "Project");
  const y0 = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(invoice.projectName, MARGIN, y0, { width: CONTENT_WIDTH });
  if (desc) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(desc, MARGIN, y0 + 15, { width: CONTENT_WIDTH, lineGap: 2 });
    doc.y = y0 + 15 + descH + SECTION_GAP;
  } else {
    doc.y = y0 + nameH + SECTION_GAP;
  }
};

const drawTableHeader = (doc, widths, y) => {
  const rowStart = MARGIN;
  doc.rect(rowStart, y, CONTENT_WIDTH, 20).fillColor(COLORS.ink).fill();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.white);
  const headers = [["#", widths[0]], ["ITEM", widths[1]], ["DESCRIPTION", widths[2]], ["QTY", widths[3]], ["UNIT PRICE", widths[4]], ["AMOUNT", widths[5]]];
  let x = rowStart + 6;
  headers.forEach(([text, w], i) => {
    doc.text(text, x, y + 6, { width: w - 12, align: i >= 3 ? "right" : "left" });
    x += w;
  });
};

const drawItemsTable = (doc, invoice) => {
  const widths = [22, 112, 148, 34, 82, 96];
  const rowStart = MARGIN;
  const items = (invoice.items || []).filter((it) => it && it.name);
  const cellHeight = (item) => {
    const desc = (item.description || "").trim() || "—";
    return Math.max(24, doc.font("Helvetica").fontSize(8).heightOfString(desc, { width: widths[2] - 12 }) + 14);
  };
  const rowHeights = items.length ? items.map(cellHeight) : [24];
  const tableH = SECTION_TITLE_HEIGHT + 20 + rowHeights.reduce((a, b) => a + b, 0) + 30 + 6;
  ensureSpace(doc, tableH);
  drawSectionTitle(doc, "Itemised Billing");

  let headerY = doc.y;
  drawTableHeader(doc, widths, headerY);

  let cy = headerY + 20;
  if (!items.length) {
    doc.rect(rowStart, cy, CONTENT_WIDTH, 24).fillColor(COLORS.white).fill();
    doc.rect(rowStart, cy, CONTENT_WIDTH, 24).lineWidth(0.6).strokeColor(COLORS.border).stroke();
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text("No line items listed", rowStart + widths[0] + 6, cy + 8, { width: CONTENT_WIDTH - 40 });
    cy += 24;
  } else {
    items.forEach((item, i) => {
      const desc = (item.description || "").trim() || "—";
      const cellH = cellHeight(item);
      if (cy + cellH > doc.page.maxY()) {
        doc.addPage();
        headerY = doc.y;
        drawTableHeader(doc, widths, headerY);
        cy = headerY + 20;
      }
      doc.rect(rowStart, cy, CONTENT_WIDTH, cellH)
        .fillColor(i % 2 === 0 ? COLORS.light : COLORS.white).fill();
      doc.rect(rowStart, cy, CONTENT_WIDTH, cellH).lineWidth(0.6).strokeColor(COLORS.border).stroke();
      let x = rowStart + 6;
      doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(String(i + 1), x, cy + 5, { width: widths[0] - 12 });
      x += widths[0];
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text(item.name, x, cy + 5, { width: widths[1] - 12 });
      x += widths[1];
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(desc, x, cy + 5, { width: widths[2] - 12, lineGap: 1 });
      x += widths[2];
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink).text(String(item.quantity || 0), x, cy + 5, { width: widths[3] - 12, align: "right" });
      x += widths[3];
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink).text(formatMoney(item.unitPrice), x, cy + 5, { width: widths[4] - 12, align: "right" });
      x += widths[4];
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text(formatMoney(item.amount), x, cy + 5, { width: widths[5] - 12, align: "right" });
      cy += cellH;
    });
  }
  doc.y = cy + SECTION_GAP;
};

const drawTotals = (doc, invoice) => {
  const boxW = 230;
  const boxX = MARGIN + CONTENT_WIDTH - boxW;
  const rowH = 17;

  const projectRows = Number(invoice.projectTotal) > 0
    ? [
        ["Project Total", formatMoney(invoice.projectTotal)],
        ["Previous Payments", formatMoney(invoice.previousPaid || 0)],
        ["Total Paid Till Date", formatMoney(invoice.totalPaidTillDate || 0)],
        ["Remaining Balance", formatMoney(invoice.remainingBalance || 0)],
      ]
    : [];

  const rows = [
    ["Subtotal", formatMoney(invoice.subtotal)],
    [`Discount${invoice.discountType === "percent" ? ` (${Number(invoice.discount) || 0}%)` : ""}`, `- ${formatMoney(invoice.discountAmount)}`],
    [`GST (${Number(invoice.taxRate) || 0}%)`, formatMoney(invoice.taxAmount)],
  ];
  const totalH = rowH * rows.length + 30;

  const paidRows = [
    ["Amount Paid", formatMoney(invoice.amountPaid)],
    ["Balance Due", formatMoney(invoice.balanceDue)],
  ];
  const projectH = projectRows.length ? projectRows.length * rowH + 12 : 0;

  ensureSpace(doc, SECTION_TITLE_HEIGHT + projectH + totalH + paidRows.length * rowH + 30 + SECTION_GAP);
  drawSectionTitle(doc, "Payment Summary");
  const y0 = doc.y;

  const drawLabelValue = (label, value, y, bold = false, color = COLORS.ink) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(COLORS.muted).text(label, boxX, y + 3, { width: boxW - 130 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(color).text(value, boxX + (boxW - 130), y + 3, { width: 120, align: "right" });
  };

  let cursor = y0;
  if (projectRows.length) {
    projectRows.forEach(([label, value], i) => {
      const isLast = i === projectRows.length - 1;
      drawLabelValue(label, value, cursor, true, isLast && (Number(invoice.remainingBalance) || 0) > 0 ? COLORS.danger : COLORS.ink);
      cursor += rowH;
    });
    cursor += 12;
  }

  rows.forEach(([label, value]) => {
    drawLabelValue(label, value, cursor);
    cursor += rowH;
  });

  const totalY = cursor;
  doc.rect(boxX - 8, totalY, boxW + 8, 30).fillColor(COLORS.softPurple).fill();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("GRAND TOTAL", boxX, totalY + 9, { width: 120 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary).text(formatMoney(invoice.totalAmount), boxX + (boxW - 130), totalY + 7, { width: 120, align: "right" });

  const paidY = totalY + 30 + 8;
  paidRows.forEach(([label, value], i) => {
    const ry = paidY + i * rowH;
    drawLabelValue(label, value, ry, true, i === 1 ? (invoice.balanceDue > 0 ? COLORS.danger : COLORS.success) : COLORS.ink);
  });

  doc.y = paidY + paidRows.length * rowH + SECTION_GAP;
};

const drawNotes = (doc, invoice) => {
  const notes = (invoice.notes || "").trim();
  const terms = (invoice.terms || "").trim();
  const notesH = notes ? doc.font("Helvetica").fontSize(8.5).heightOfString(notes, { width: CONTENT_WIDTH }) + 16 : 0;
  const termsTitleH = notes ? SECTION_TITLE_HEIGHT : 0;
  drawSectionTitle(doc, "Notes");
  if (notes) {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(notes, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
    doc.y += notesH;
  } else {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text("Thank you for your business.", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 16;
  }
  const termsH = computeTermsHeight(doc, invoice);
  if (termsTitleH + termsH > 0) {
    ensureSpace(doc, SECTION_TITLE_HEIGHT + termsH + SIGNATURE_HEIGHT);
    drawTerms(doc, invoice, terms);
  }
};

const computeTermsHeight = (doc, invoice) => {
  let h = SECTION_TITLE_HEIGHT;
  const terms = (invoice.terms || "").trim();
  if (terms) {
    h += doc.font("Helvetica").fontSize(8.5).heightOfString(terms, { width: CONTENT_WIDTH - 18 }) + 6;
  } else {
    INVOICE_TERMS.forEach((term) => {
      const termH = doc.font("Helvetica").fontSize(8.5).heightOfString(term, { width: CONTENT_WIDTH - 18 });
      h += termH + 4;
    });
  }
  return h;
};

const drawTerms = (doc, invoice, customTerms) => {
  drawSectionTitle(doc, "Terms & Conditions");
  const terms = (customTerms || "").trim() || INVOICE_TERMS;
  if (typeof terms === "string") {
    const termH = doc.font("Helvetica").fontSize(8.5).heightOfString(terms, { width: CONTENT_WIDTH - 18 });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(terms, MARGIN + 18, doc.y, { width: CONTENT_WIDTH - 18, lineGap: 2 });
    doc.y += termH + 4;
    return;
  }
  terms.forEach((term, i) => {
    const termH = doc.font("Helvetica").fontSize(8.5).heightOfString(term, { width: CONTENT_WIDTH - 18 });
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.primary).text(`${i + 1}.`, MARGIN, y, { width: 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(term, MARGIN + 18, y, { width: CONTENT_WIDTH - 18, lineGap: 1 });
    doc.y = y + termH + 4;
  });
};

const drawSignature = (doc) => {
  const y = doc.y;
  const boxX = PAGE_WIDTH - MARGIN - 190;
  const boxW = 190;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text("For Skyntrix Technologies", boxX, y);
  doc.moveTo(boxX, y + 32).lineTo(boxX + boxW, y + 32).lineWidth(1).strokeColor(COLORS.ink).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(COMPANY.founder, boxX, y + 38);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(COMPANY.founderTitle, boxX, y + 52);
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
 * Generate a branded A4 invoice PDF and write it to uploads/invoices using an
 * atomic temp-file + rename so a reader can never observe a partial file.
 * @returns {{ path: string, url: string, filename: string }}
 */
export const generateInvoicePdf = async (invoice) => {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
  const filename = `${invoice.invoiceNumber}.pdf`;
  const filePath = path.join(INVOICES_DIR, filename);
  const fileUrl = `${String(env.uploadUrl).replace(/\/+$/, "")}/uploads/invoices/${filename}`;

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: { top: 40, left: MARGIN, right: MARGIN, bottom: 90 }, bufferPages: true });
      const stream = fs.createWriteStream(tmpPath);

      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      doc.pipe(stream);
      drawHeader(doc, invoice);
      doc.y = 148;

      drawInfoCard(doc, invoice);
      drawProject(doc, invoice);
      drawItemsTable(doc, invoice);
      drawTotals(doc, invoice);
      drawNotes(doc, invoice);

      ensureSpace(doc, computeTermsHeight(doc, invoice) + SIGNATURE_HEIGHT);
      drawSignature(doc);

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

  logger.info(`[Invoice] PDF generated: ${filePath}`);
  return { path: filePath, url: fileUrl, filename };
};

/** Make sure a current PDF exists for the invoice, optionally forcing a regen. */
export const ensureInvoicePdf = async (invoice, { force = false } = {}) => {
  if (!force && invoice.pdfPath && fs.existsSync(invoice.pdfPath)) {
    return invoice;
  }
  const pdf = await generateInvoicePdf(invoice);
  invoice.pdfUrl = pdf.url;
  invoice.pdfPath = pdf.path;
  await invoice.save();
  return invoice;
};

/** Remove the invoice PDF file from disk (best effort). */
export const deleteInvoicePdf = (pdfPath) => {
  if (!pdfPath) return;
  try {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  } catch (err) {
    logger.warn(`[Invoice] could not delete PDF ${pdfPath}: ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// WhatsApp / email messaging
// ---------------------------------------------------------------------------

export const buildInvoiceMessage = (invoice, { includePdfLink = false } = {}) => {
  const name = (invoice.clientName || "").trim() || "there";
  const total = Number(invoice.totalAmount || 0).toLocaleString("en-IN");
  const paid = Number(invoice.amountPaid || 0).toLocaleString("en-IN");
  const balance = Number(invoice.balanceDue || 0).toLocaleString("en-IN");
  const project = (invoice.projectName || "").trim() || "\u2014";
  const lines = [
    `Hello ${name},`,
    "",
    "Thank you for choosing Skyntrix Technologies.",
    "",
    "Please find your invoice attached.",
    "",
    `Invoice No: ${invoice.invoiceNumber || "\u2014"}`,
    `Project: ${project}`,
    `Total Amount: \u20B9${total}`,
    `Amount Paid: \u20B9${paid}`,
    `Balance Due: \u20B9${balance}`,
    `Due Date: ${invoice.dueDate ? formatDate(invoice.dueDate) : "\u2014"}`,
  ];
  if (includePdfLink && isPubliclyReachableUrl(invoice.pdfUrl)) {
    lines.push("", `Download PDF: ${invoice.pdfUrl}`);
  }
  lines.push(
    "",
    "If you have any questions regarding this invoice, feel free to contact us.",
    "",
    "Regards,",
    "Senthil Kumar",
    "Founder",
    "Skyntrix Technologies"
  );
  return lines.join("\n");
};

export const buildInvoiceDocumentCaption = (invoice) => {
  const total = Number(invoice.totalAmount || 0).toLocaleString("en-IN");
  const balance = Number(invoice.balanceDue || 0).toLocaleString("en-IN");
  const project = (invoice.projectName || "").trim() || "\u2014";
  return [
    "Please find your invoice attached.",
    "",
    `Invoice No: ${invoice.invoiceNumber || "\u2014"}`,
    `Project: ${project}`,
    `Total Amount: \u20B9${total}`,
    `Balance Due: \u20B9${balance}`,
  ].join("\n");
};

/** Params for the pre-approved invoice template ({{1}} name, {{2}} no, {{3}} project, {{4}} total). */
export const buildInvoiceTemplateParams = (invoice) => {
  const total = Number(invoice.totalAmount || 0).toLocaleString("en-IN");
  return [
    (invoice.clientName || "").trim() || "there",
    invoice.invoiceNumber || "-",
    (invoice.projectName || "").trim() || "-",
    `\u20B9${total}`,
  ];
};

/**
 * Send the invoice PDF followed by the personalized text message (document first
 * so the client never gets a "please find attached" note when the PDF failed).
 */
export const sendInvoiceFollowUp = async (invoice) => {
  const digits = normalizeMobileNumber(invoice.mobile);
  if (!digits) {
    return { status: "failed", textMessageId: "", documentMessageId: "", error: "Invalid mobile number", errorCode: 0 };
  }
  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, buildInvoiceMessage(invoice, { includePdfLink: true }));
    return { status: "fallback", textMessageId: "", documentMessageId: "", waUrl, error: "", errorCode: 0 };
  }

  const doc = await sendWhatsAppDocument({
    to: digits,
    filePath: invoice.pdfPath || "",
    link: isPubliclyReachableUrl(invoice.pdfUrl) ? invoice.pdfUrl : "",
    caption: buildInvoiceDocumentCaption(invoice),
    filename: `Invoice - ${invoice.invoiceNumber}.pdf`,
  });

  if (doc.status !== "success") {
    const error = doc.error || "WhatsApp PDF document send failed";
    logger.error(`[Invoice] document send failed for ${digits}: ${error}`);
    return { status: "failed", textMessageId: "", documentMessageId: "", error, errorCode: doc.errorCode || 0 };
  }

  const text = await sendWhatsAppMessage({
    to: digits,
    body: buildInvoiceMessage(invoice, { includePdfLink: false }),
  });
  if (text.status === "failed") {
    logger.error(`[Invoice] text message failed for ${digits}: ${text.error}`);
    return { status: "failed", textMessageId: "", documentMessageId: doc.providerMessageId || "", error: text.error || "WhatsApp text message failed", errorCode: text.errorCode || 0 };
  }

  logger.info(`[Invoice] document + text sent to ${digits}`);
  return {
    status: "success",
    textMessageId: text.providerMessageId || "",
    documentMessageId: doc.providerMessageId || "",
    error: "",
    errorCode: 0,
  };
};

/**
 * Send the invoice to the client's WhatsApp number, fully automated. Mirrors the
 * quotation flow: free-form PDF + text when the 24h window is open, a
 * pre-approved template to open the conversation otherwise, and a wa.me link as
 * the final fallback.
 */
export const sendInvoiceWhatsApp = async (invoice) => {
  const digits = normalizeMobileNumber(invoice.mobile);
  if (!digits) {
    return { status: "failed", textMessageId: "", documentMessageId: "", templateMessageId: "", error: "Invalid mobile number", errorCode: 0 };
  }

  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, buildInvoiceMessage(invoice, { includePdfLink: true }));
    logger.info(`[Invoice] Cloud API unavailable - fallback link for ${digits}`);
    return { status: "fallback", textMessageId: "", documentMessageId: "", templateMessageId: "", waUrl, error: "", errorCode: 0 };
  }

  if (await isActiveConversation(digits)) {
    logger.info(`[Invoice] active session for ${digits} - sending free-form PDF + text`);
    const followUp = await sendInvoiceFollowUp(invoice);
    return { ...followUp, templateMessageId: "" };
  }

  const followUp = await sendInvoiceFollowUp(invoice);
  if (followUp.status === "success") {
    return { ...followUp, templateMessageId: "" };
  }

  if (followUp.errorCode === SESSION_ENDED_ERROR) {
    logger.info(`[Invoice] no open session for ${digits} - initiating via template`);
    const template = await sendWhatsAppTemplate({
      to: digits,
      templateName: env.whatsapp.invoiceTemplateName,
      language: env.whatsapp.invoiceTemplateLang,
      bodyParams: buildInvoiceTemplateParams(invoice),
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

    logger.error(`[Invoice] template initiation failed for ${digits}: ${template.error}`);
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

/** Branded HTML invoice for email delivery (with the PDF attached). */
export const buildInvoiceEmailHtml = (invoice) => {
  const rows = (invoice.items || []).map(
    (item) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #E5E7EB">${escHtml(item.name)}<br/><span style="color:#9CA3AF;font-size:11px">${escHtml(item.description || "")}</span></td>
        <td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;text-align:center">${Number(item.quantity) || 0}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;text-align:right">${formatMoney(item.unitPrice)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700">${formatMoney(item.amount)}</td>
      </tr>`
  ).join("");
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#0B1120">
      <div style="background:#0B1120;color:#fff;padding:22px 28px;border-radius:8px 8px 0 0">
        <div style="font-size:18px;font-weight:700">Skyntrix Technologies</div>
        <div style="color:#C4B5FD;font-size:12px">Building Digital Experiences That Drive Growth</div>
        <div style="margin-top:10px;font-size:20px;font-weight:800;letter-spacing:1px">INVOICE</div>
        <div style="color:#A5B4FC;font-size:12px">No: ${escHtml(invoice.invoiceNumber)} &nbsp;|&nbsp; Date: ${formatDate(invoice.invoiceDate)} &nbsp;|&nbsp; Due: ${formatDate(invoice.dueDate)}</div>
      </div>
      <div style="border:1px solid #E5E7EB;border-top:0;padding:22px 28px">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr>
            <td style="width:50%;vertical-align:top">
              <div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px">BILL TO</div>
              <div style="font-weight:700">${escHtml(invoice.clientName)}</div>
              <div style="color:#6B7280;font-size:12px">${escHtml(invoice.businessName)}<br/>${escHtml(invoice.billingAddress)}<br/>${escHtml(invoice.mobile)}<br/>${escHtml(invoice.email)}</div>
            </td>
            <td style="vertical-align:top;text-align:right">
              <div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px">PROJECT</div>
              <div style="font-weight:700">${escHtml(invoice.projectName)}</div>
              <div style="color:#6B7280;font-size:12px">Status: ${escHtml(String(invoice.paymentStatus || "pending").toUpperCase())}</div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#0B1120;color:#fff;text-align:left">
              <th style="padding:8px 10px">ITEM</th><th style="padding:8px 10px;text-align:center">QTY</th><th style="padding:8px 10px;text-align:right">UNIT PRICE</th><th style="padding:8px 10px;text-align:right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <table style="width:100%;margin-top:16px;font-size:13px">
          <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Subtotal</td><td style="text-align:right;padding:3px 8px;width:120px">${formatMoney(invoice.subtotal)}</td></tr>
          <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Discount</td><td style="text-align:right;padding:3px 8px">- ${formatMoney(invoice.discountAmount)}</td></tr>
          <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">GST (${Number(invoice.taxRate) || 0}%)</td><td style="text-align:right;padding:3px 8px">${formatMoney(invoice.taxAmount)}</td></tr>
          <tr style="background:#EDE9FE;font-weight:800;font-size:14px"><td style="padding:8px;text-align:right">GRAND TOTAL</td><td style="padding:8px;text-align:right;color:#6D28D9">${formatMoney(invoice.totalAmount)}</td></tr>
          <tr><td style="text-align:right;color:#6B7280;padding:3px 8px">Amount Paid</td><td style="text-align:right;padding:3px 8px">${formatMoney(invoice.amountPaid)}</td></tr>
          <tr><td style="text-align:right;font-weight:700;padding:3px 8px">Balance Due</td><td style="text-align:right;font-weight:700;padding:3px 8px;color:${invoice.balanceDue > 0 ? "#DC2626" : "#059669"}">${formatMoney(invoice.balanceDue)}</td></tr>
        </table>
        <p style="color:#6B7280;font-size:12px;margin-top:18px">${escHtml(invoice.notes || "")}</p>
        <p style="border-top:1px solid #E5E7EB;padding-top:12px;font-size:12px;color:#6B7280">${escHtml(invoice.terms || "")}</p>
        <p style="text-align:right;margin-top:18px;font-size:13px">For Skyntrix Technologies<br/><strong>Senthil Kumar</strong><br/><span style="color:#6B7280">Founder</span></p>
      </div>
      <div style="background:#111827;color:#9CA3AF;font-size:12px;padding:14px 28px;border-radius:0 0 8px 8px">
        ${escHtml(COMPANY.website)} | ${escHtml(COMPANY.email)} | ${escHtml(COMPANY.phone)}
      </div>
    </div>`;
};

export const buildInvoiceEmailSubject = (invoice) => `Invoice ${invoice.invoiceNumber} - ${invoice.clientName} - ${formatMoney(invoice.totalAmount)}`;

/** Email the invoice PDF to the client's address. Returns a result object. */
export const sendInvoiceEmail = async (invoice) => {
  if (!invoice.email) {
    return { status: "failed", channel: "email", error: "No client email address", errorCode: 0 };
  }
  try {
    await sendMail({
      to: invoice.email,
      subject: buildInvoiceEmailSubject(invoice),
      html: buildInvoiceEmailHtml(invoice),
      text: buildInvoiceMessage(invoice, { includePdfLink: isPubliclyReachableUrl(invoice.pdfUrl) }),
      attachments: [{ filename: `Invoice - ${invoice.invoiceNumber}.pdf`, path: invoice.pdfPath }],
    });
    logger.info(`[Invoice] email sent to ${invoice.email}`);
    return { status: "success", channel: "email", error: "", errorCode: 0 };
  } catch (err) {
    logger.error(`[Invoice] email send failed for ${invoice.invoiceNumber}: ${err.message}`);
    return { status: "failed", channel: "email", error: err.message || "Email send failed", errorCode: 0 };
  }
};
