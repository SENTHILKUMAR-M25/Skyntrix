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
// Keeps the last content line safely above the fixed footer band.
const BOTTOM_MARGIN = 70;

// Modern brand typography. Inter static TTFs ship under server/assets/fonts;
// we fall back to the Helvetica family if they are ever missing so a PDF can
// never fail to render on a machine without the font assets.
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONT_FILES = {
  regular: path.join(FONT_DIR, "Inter-Regular.ttf"),
  medium: path.join(FONT_DIR, "Inter-Medium.ttf"),
  semibold: path.join(FONT_DIR, "Inter-SemiBold.ttf"),
  bold: path.join(FONT_DIR, "Inter-Bold.ttf"),
};
const HAS_INTER = Object.values(FONT_FILES).every((f) => fs.existsSync(f));
const F = {
  regular: HAS_INTER ? "Inter" : "Helvetica",
  medium: HAS_INTER ? "Inter-Medium" : "Helvetica",
  semibold: HAS_INTER ? "Inter-SemiBold" : "Helvetica-Bold",
  bold: HAS_INTER ? "Inter-Bold" : "Helvetica-Bold",
};

const COLORS = {
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  label: "#94A3B8",
  border: "#E2E8F0",
  light: "#F8FAFC",
  white: "#FFFFFF",
  primary: "#6D28D9",
  primaryDark: "#5B21B6",
  softPurple: "#EDE9FE",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
};

// Vertical rhythm. Every section is sized off these primitives so spacing stays
// consistent and page breaks only ever fall on whole sections.
const SECTION_TITLE_HEIGHT = 26;
const SIGNATURE_HEIGHT = 66;
const SECTION_GAP = 8;
const CONTENT_TOP = 132;
const CARD_PAD = 16;
const ROW_GAP = 7;

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

const textH = (doc, str, size, family, width) => {
  doc.font(family).fontSize(size);
  return doc.heightOfString(String(str ?? " "), { width });
};

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, SECTION_TITLE_HEIGHT);
  const y = doc.y;
  doc.font(F.semibold).fontSize(9.5).fillColor(COLORS.ink)
    .text(title.toUpperCase(), MARGIN, y, { width: CONTENT_WIDTH, characterSpacing: 0.6 });
  doc.rect(MARGIN, y + 13.5, 24, 2.5).fillColor(COLORS.primary).fill();
  doc.moveTo(MARGIN, y + 19.5).lineTo(PAGE_WIDTH - MARGIN, y + 19.5).lineWidth(0.8).strokeColor(COLORS.border).stroke();
  doc.y = y + SECTION_TITLE_HEIGHT;
};

const drawHeader = (doc, invoice) => {
  doc.rect(0, 0, PAGE_WIDTH, 118).fillColor(COLORS.ink).fill();
  doc.rect(0, 118, PAGE_WIDTH, 4).fillColor(COLORS.primary).fill();

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, 30, { width: 52, height: 52 });
    }
  } catch (err) {
    logger.warn(`[Invoice] logo render skipped: ${err.message}`);
  }

  doc.font(F.bold).fontSize(16).fillColor(COLORS.white).text(COMPANY.name, 111, 30, { width: 235, characterSpacing: 0.2 });
  doc.font(F.regular).fontSize(8).fillColor("#C4B5FD").text(COMPANY.tagline, 111, 54, { width: 235, characterSpacing: 0.2 });

  const rightX = PAGE_WIDTH - MARGIN - 210;
  doc.font(F.semibold).fontSize(16).fillColor(COLORS.white)
    .text("INVOICE", rightX, 20, { width: 210, align: "right", characterSpacing: 2 });
  doc.font(F.semibold).fontSize(9).fillColor("#E9D5FF")
    .text(`No: ${invoice.invoiceNumber}`, rightX, 46, { width: 210, align: "right" });
  doc.font(F.regular).fontSize(8.5).fillColor("#A5B4FC")
    .text(`Date: ${formatDate(invoice.invoiceDate)}`, rightX, 63, { width: 210, align: "right" });
  doc.font(F.regular).fontSize(8.5).fillColor("#A5B4FC")
    .text(`Due Date: ${formatDate(invoice.dueDate)}`, rightX, 79, { width: 210, align: "right" });

  const statusCfg = {
    paid: { bg: "#064E3B", fg: "#6EE7B7" },
    overdue: { bg: "#7F1D1D", fg: "#FCA5A5" },
    partial: { bg: "#5B21B6", fg: "#DDD6FE" },
    pending: { bg: "#1E293B", fg: "#FDE68A" },
  };
  const cfg = statusCfg[invoice.paymentStatus] || statusCfg.pending;
  const statusText = `STATUS: ${String(invoice.paymentStatus || "pending").toUpperCase()}`;
  const pillW = doc.font(F.semibold).fontSize(7.5).widthOfString(statusText) + 18;
  doc.roundedRect(PAGE_WIDTH - MARGIN - pillW, 97, pillW, 15, 7.5).fillColor(cfg.bg).fill();
  doc.font(F.semibold).fontSize(7.5).fillColor(cfg.fg)
    .text(statusText, PAGE_WIDTH - MARGIN - pillW + 9, 99.5, { width: pillW - 18, align: "center", characterSpacing: 0.6 });
};

const formatMobileDisplay = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return String(value || "—");
};

/**
 * Single rounded card split into two equal columns (Bill To | Invoice Details)
 * on a shared vertical grid, with labels and values aligned so both columns
 * always read as one balanced, premium unit.
 */
const drawInfoCard = (doc, invoice) => {
  const padX = CARD_PAD;
  const padY = 13;
  const titleH = 22;
  const colGap = 20;
  const colW = (CONTENT_WIDTH - colGap) / 2;
  const labelW = 72;
  const valueW = colW - labelW - padX;
  const leftX = MARGIN + padX;
  const rightX = MARGIN + colW + colGap + padX;

  const rows = [
    [["CLIENT", invoice.clientName], ["PROJECT", invoice.projectName]],
    [["BUSINESS", invoice.businessName], ["TYPE", String(invoice.type || "full").toUpperCase()]],
    [["MOBILE", formatMobileDisplay(invoice.mobile)], ["QUOTATION", invoice.quotationNumber || "—"]],
    [["EMAIL", invoice.email], ["PAYMENT METHOD", String(invoice.paymentMethod || "—").toUpperCase().replace(/_/g, " ")]],
    [["ADDRESS", invoice.billingAddress], ["GSTIN", invoice.gstin || "—"]],
  ];

  const rowHs = rows.map(([l, r]) => {
    const lh = textH(doc, l[1], 8, F.regular, valueW);
    const rh = textH(doc, r[1], 8, F.regular, valueW);
    return Math.max(13, Math.max(lh, rh));
  });
  let bodyH = 0;
  rowHs.forEach((h, i) => { bodyH += h + (i === rowHs.length - 1 ? 0 : ROW_GAP); });

  const cardH = titleH + bodyH + padY;
  ensureSpace(doc, cardH + SECTION_GAP);
  const y = doc.y;

  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 8).fillColor(COLORS.light).fill();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 8).lineWidth(1).strokeColor(COLORS.border).stroke();

  doc.font(F.semibold).fontSize(8).fillColor(COLORS.primary);
  doc.text("BILL TO", leftX, y + 9, { width: colW - padX, lineBreak: false, characterSpacing: 0.5 });
  doc.text("INVOICE DETAILS", rightX, y + 9, { width: colW - padX, lineBreak: false, characterSpacing: 0.5 });

  doc.moveTo(MARGIN + padX, y + titleH - 2).lineTo(PAGE_WIDTH - MARGIN - padX, y + titleH - 2)
    .lineWidth(0.7).strokeColor(COLORS.border).stroke();
  const midX = MARGIN + colW + colGap / 2;
  doc.moveTo(midX, y + titleH + 2).lineTo(midX, y + cardH - 6)
    .lineWidth(0.7).strokeColor(COLORS.border).stroke();

  let cursor = y + titleH;
  rows.forEach((pair, i) => {
    pair.forEach(([label, value], col) => {
      const x = col === 0 ? leftX : rightX;
      doc.font(F.bold).fontSize(6.5).fillColor(COLORS.label)
        .text(label, x, cursor + 1, { width: labelW, lineBreak: false, characterSpacing: 0.5 });
      doc.font(F.regular).fontSize(8).fillColor(COLORS.ink)
        .text(String(value || "—"), x + labelW, cursor, { width: valueW, lineGap: 1 });
    });
    cursor += rowHs[i] + (i === rowHs.length - 1 ? 0 : ROW_GAP);
  });

  doc.y = y + cardH + SECTION_GAP;
};

/** Project Information card placed immediately below the info card. */
const drawProject = (doc, invoice) => {
  const desc = (invoice.projectDescription || "").trim();
  const nameH = 15;
  const descGap = 4;
  const descH = desc ? textH(doc, desc, 8.5, F.regular, CONTENT_WIDTH - CARD_PAD * 2) : 0;
  const cardH = CARD_PAD + nameH + (desc ? descGap + descH : 0) + CARD_PAD;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + cardH + SECTION_GAP);
  drawSectionTitle(doc, "Project");

  const y0 = doc.y;
  doc.roundedRect(MARGIN, y0, CONTENT_WIDTH, cardH, 8).fillColor(COLORS.light).fill();
  doc.roundedRect(MARGIN, y0, CONTENT_WIDTH, cardH, 8).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.font(F.semibold).fontSize(10.5).fillColor(COLORS.ink)
    .text(invoice.projectName, MARGIN + CARD_PAD, y0 + CARD_PAD, { width: CONTENT_WIDTH - CARD_PAD * 2 });
  if (desc) {
    doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted)
      .text(desc, MARGIN + CARD_PAD, y0 + CARD_PAD + nameH + descGap, { width: CONTENT_WIDTH - CARD_PAD * 2, lineGap: 2 });
  }
  doc.y = y0 + cardH + SECTION_GAP;
};

// Itemised billing grid. Balanced column widths so every column aligns and the
// two currency columns are equal; numeric cells are right aligned.
const TABLE_COLS = [
  { width: 26, align: "left" },
  { width: 118, align: "left" },
  { width: 122, align: "left" },
  { width: 40, align: "right" },
  { width: 98, align: "right" },
  { width: 101.28, align: "right" },
];

const drawTableHeader = (doc, y) => {
  const rowStart = MARGIN;
  doc.rect(rowStart, y, CONTENT_WIDTH, 21).fillColor(COLORS.ink).fill();
  doc.font(F.semibold).fontSize(7.5).fillColor(COLORS.white);
  const headers = ["#", "ITEM", "DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"];
  let x = rowStart;
  headers.forEach((text, i) => {
    const col = TABLE_COLS[i];
    doc.text(text, x + 7, y + 6.5, { width: col.width - 14, align: col.align, characterSpacing: 0.4 });
    x += col.width;
  });
};

const drawItemsTable = (doc, invoice) => {
  const rowStart = MARGIN;
  const colXs = (() => { let acc = rowStart; return TABLE_COLS.map((c) => { const x = acc; acc += c.width; return x; }); })();
  const items = (invoice.items || []).filter((it) => it && it.name);
  const descW = TABLE_COLS[2].width - 14;
  const nameW = TABLE_COLS[1].width - 14;
  const cellH = (item) => {
    const desc = (item.description || "").trim() || "—";
    const dh = textH(doc, desc, 8, F.regular, descW);
    const nh = textH(doc, item.name, 8.5, F.semibold, nameW);
    return Math.max(22, dh + 14, nh + 10);
  };
  const rowHs = items.length ? items.map(cellH) : [22];
  // Only require the title, header and first row to fit together; further rows
  // flow across pages with the header repeated, so a long table never wastes a
  // mostly-empty first page.
  const firstRowH = rowHs[0] || 22;
  ensureSpace(doc, SECTION_TITLE_HEIGHT + 21 + firstRowH + SECTION_GAP);
  drawSectionTitle(doc, "Itemised Billing");

  let headerY = doc.y;
  drawTableHeader(doc, headerY);
  let cy = headerY + 21;

  const drawCell = (str, family, size, color, colIndex, rowH, multiLine = false) => {
    const col = TABLE_COLS[colIndex];
    const padX = 7;
    const w = col.width - padX * 2;
    const x = colXs[colIndex] + padX;
    const th = textH(doc, str, size, family, w);
    const ty = cy + Math.max(0, (rowH - th) / 2);
    if (multiLine) {
      doc.font(family).fontSize(size).fillColor(color).text(str, x, ty, { width: w, lineGap: 1 });
    } else {
      doc.font(family).fontSize(size).fillColor(color)
        .text(str, x, ty, { width: w, align: col.align === "right" ? "right" : "left", lineBreak: false });
    }
  };

  if (!items.length) {
    doc.rect(rowStart, cy, CONTENT_WIDTH, 22).fillColor(COLORS.white).fill();
    doc.rect(rowStart, cy, CONTENT_WIDTH, 22).lineWidth(0.7).strokeColor(COLORS.border).stroke();
    doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted)
      .text("No line items listed", rowStart + 10, cy + 6.5, { width: CONTENT_WIDTH - 20 });
    cy += 22;
  } else {
    items.forEach((item, i) => {
      const h = rowHs[i];
      if (cy + h > doc.page.maxY()) {
        doc.addPage();
        headerY = doc.y;
        drawTableHeader(doc, headerY);
        cy = headerY + 21;
      }
      doc.rect(rowStart, cy, CONTENT_WIDTH, h).fillColor(i % 2 === 0 ? COLORS.light : COLORS.white).fill();
      doc.rect(rowStart, cy, CONTENT_WIDTH, h).lineWidth(0.7).strokeColor(COLORS.border).stroke();

      const desc = (item.description || "").trim() || "—";
      drawCell(String(i + 1), F.regular, 8, COLORS.muted, 0, h);
      drawCell(item.name, F.semibold, 8.5, COLORS.ink, 1, h);
      drawCell(desc, F.regular, 8, COLORS.muted, 2, h, true);
      drawCell(String(item.quantity || 0), F.regular, 8, COLORS.ink, 3, h);
      drawCell(formatMoney(item.unitPrice), F.regular, 8, COLORS.ink, 4, h);
      drawCell(formatMoney(item.amount), F.semibold, 8.5, COLORS.ink, 5, h);
      cy += h;
    });
  }
  doc.y = cy + SECTION_GAP;
};

/**
 * Notes card on the left and a dedicated Payment Summary card on the right,
 * rendered side-by-side so nothing is wasted below the table. Labels are left
 * aligned, currency values right aligned, and the Grand Total sits in a clearly
 * highlighted band.
 */
const drawNotesAndSummary = (doc, invoice) => {
  const padX = CARD_PAD;
  const padY = 14;
  const titleH = 22;
  const colGap = 14;
  const colW = (CONTENT_WIDTH - colGap) / 2;
  const leftX = MARGIN + padX;
  const summaryX = MARGIN + colW + colGap;
  const rightX = summaryX + padX;
  const innerW = colW - padX * 2;
  const rowH = 13.5;

  const projectRows = Number(invoice.projectTotal) > 0
    ? [
        ["Project Total", formatMoney(invoice.projectTotal)],
        ["Previous Payments", formatMoney(invoice.previousPaid || 0)],
        ["Total Paid Till Date", formatMoney(invoice.totalPaidTillDate || 0)],
        ["Remaining Balance", formatMoney(invoice.remainingBalance || 0)],
      ]
    : [];
  const subtotalRows = [
    ["Subtotal", formatMoney(invoice.subtotal)],
    [`Discount${invoice.discountType === "percent" ? ` (${Number(invoice.discount) || 0}%)` : ""}`, `- ${formatMoney(invoice.discountAmount)}`],
    [`GST (${Number(invoice.taxRate) || 0}%)`, formatMoney(invoice.taxAmount)],
  ];
  const paidRows = [
    ["Amount Paid", formatMoney(invoice.amountPaid)],
    ["Balance Due", formatMoney(invoice.balanceDue)],
  ];

  const summaryBodyH = (projectRows.length + subtotalRows.length + paidRows.length) * rowH + 33;
  const summaryH = titleH + summaryBodyH + padY;

  const notesText = (invoice.notes || "").trim() || "Thank you for your business.";
  const notesBodyH = textH(doc, notesText, 8.5, F.regular, innerW) + 2;
  const notesH = titleH + notesBodyH + padY;

  const rowTotalH = Math.max(summaryH, notesH);
  ensureSpace(doc, rowTotalH + SECTION_GAP);
  const y = doc.y;

  doc.roundedRect(MARGIN, y, colW, rowTotalH, 8).fillColor(COLORS.light).fill();
  doc.roundedRect(MARGIN, y, colW, rowTotalH, 8).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.font(F.semibold).fontSize(8).fillColor(COLORS.primary)
    .text("NOTES", leftX, y + 9, { width: innerW, characterSpacing: 0.5 });
  doc.moveTo(MARGIN + padX, y + titleH - 2).lineTo(MARGIN + colW - padX, y + titleH - 2)
    .lineWidth(0.7).strokeColor(COLORS.border).stroke();
  doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted)
    .text(notesText, leftX, y + titleH + 6, { width: innerW, lineGap: 2 });

  doc.roundedRect(summaryX, y, colW, rowTotalH, 8).fillColor(COLORS.white).fill();
  doc.roundedRect(summaryX, y, colW, rowTotalH, 8).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.font(F.semibold).fontSize(8).fillColor(COLORS.primary)
    .text("PAYMENT SUMMARY", rightX, y + 9, { width: innerW, characterSpacing: 0.5 });
  doc.moveTo(summaryX + padX, y + titleH - 2).lineTo(summaryX + colW - padX, y + titleH - 2)
    .lineWidth(0.7).strokeColor(COLORS.border).stroke();

  const labelX = rightX;
  const valueX = summaryX + colW - padX - 100;
  const valueW = 100;
  const drawRow = (label, value, yy, opts = {}) => {
    doc.font(opts.bold ? F.semibold : F.regular).fontSize(7.5)
      .fillColor(opts.color || COLORS.muted).text(label, labelX, yy, { width: valueX - labelX - 4, lineBreak: false });
    doc.font(opts.bold ? F.semibold : F.regular).fontSize(8)
      .fillColor(opts.valueColor || COLORS.ink).text(value, valueX, yy - 0.5, { width: valueW, align: "right", lineBreak: false });
  };

  let cursor = y + titleH + 4;
  projectRows.forEach(([label, value], i) => {
    const isLast = i === projectRows.length - 1;
    drawRow(label, value, cursor, {
      bold: true,
      valueColor: isLast && (Number(invoice.remainingBalance) || 0) > 0 ? COLORS.danger : COLORS.ink,
    });
    cursor += rowH;
  });
  subtotalRows.forEach(([label, value]) => {
    drawRow(label, value, cursor);
    cursor += rowH;
  });

  const totalBandY = cursor + 3;
  const bandH = 21;
  doc.roundedRect(summaryX + 8, totalBandY, colW - 16, bandH, 5).fillColor(COLORS.softPurple).fill();
  doc.font(F.bold).fontSize(8.5).fillColor(COLORS.ink)
    .text("GRAND TOTAL", labelX, totalBandY + 5.5, { width: valueX - labelX - 4, lineBreak: false });
  doc.font(F.bold).fontSize(10.5).fillColor(COLORS.primary)
    .text(formatMoney(invoice.totalAmount), valueX, totalBandY + 3.5, { width: valueW, align: "right", lineBreak: false });

  const paidY = totalBandY + bandH + 5;
  paidRows.forEach(([label, value], i) => {
    drawRow(label, value, paidY + i * rowH, {
      bold: true,
      valueColor: i === 1 ? (Number(invoice.balanceDue) > 0 ? COLORS.danger : COLORS.success) : COLORS.ink,
    });
  });

  doc.y = y + rowTotalH + SECTION_GAP;
};

const computeTermsHeight = (doc, invoice) => {
  let h = SECTION_TITLE_HEIGHT;
  const terms = (invoice.terms || "").trim();
  if (terms) {
    h += textH(doc, terms, 8.5, F.regular, CONTENT_WIDTH - 18) + 6;
  } else {
    INVOICE_TERMS.forEach((term) => {
      h += textH(doc, term, 8.5, F.regular, CONTENT_WIDTH - 18) + 4;
    });
  }
  return h;
};

const drawTerms = (doc, invoice) => {
  drawSectionTitle(doc, "Terms & Conditions");
  const terms = (invoice.terms || "").trim();
  if (terms) {
    const th = textH(doc, terms, 8.5, F.regular, CONTENT_WIDTH - 18);
    doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted)
      .text(terms, MARGIN + 18, doc.y, { width: CONTENT_WIDTH - 18, lineGap: 2 });
    doc.y += th + 4;
    return;
  }
  INVOICE_TERMS.forEach((term, i) => {
    const th = textH(doc, term, 8.5, F.regular, CONTENT_WIDTH - 18);
    const y = doc.y;
    doc.font(F.semibold).fontSize(8.5).fillColor(COLORS.primary)
      .text(`${i + 1}.`, MARGIN, y, { width: 16, lineBreak: false });
    doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted)
      .text(term, MARGIN + 18, y, { width: CONTENT_WIDTH - 18, lineGap: 1 });
    doc.y = y + th + 4;
  });
};

const drawSignature = (doc) => {
  const y = doc.y;
  const boxX = PAGE_WIDTH - MARGIN - 190;
  const boxW = 190;
  doc.font(F.semibold).fontSize(8.5).fillColor(COLORS.ink).text("For Skyntrix Technologies", boxX, y, { width: boxW, align: "right" });
  doc.moveTo(boxX, y + 30).lineTo(boxX + boxW, y + 30).lineWidth(1).strokeColor(COLORS.ink).stroke();
  doc.font(F.semibold).fontSize(10).fillColor(COLORS.ink).text(COMPANY.founder, boxX, y + 36, { width: boxW, align: "right" });
  doc.font(F.regular).fontSize(8.5).fillColor(COLORS.muted).text(COMPANY.founderTitle, boxX, y + 50, { width: boxW, align: "right" });
  doc.y = y + SIGNATURE_HEIGHT;
};

const drawFooter = (doc, pageIndex, totalPages) => {
  const y = PAGE_HEIGHT - 52;
  doc.rect(0, y - 12, PAGE_WIDTH, 46).fillColor("#111827").fill();
  doc.rect(0, y - 12, PAGE_WIDTH, 3).fillColor(COLORS.primary).fill();
  // lineBreak:false AND no width -> bypasses the LineWrapper entirely. A width
  // (or width auto-set) forces text through LineWrapper, whose auto page-break
  // check sees the footer below the bottom margin and adds a page, recursing.
  doc.font(F.bold).fontSize(7.5).fillColor("#E5E7EB").text(COMPANY.name, MARGIN, y, { lineBreak: false });
  doc.font(F.regular).fontSize(7.5).fillColor("#9CA3AF").text(COMPANY.address, MARGIN, y + 11, { lineBreak: false });
  doc.font(F.regular).fontSize(7.5).fillColor("#D1D5DB").text(`${COMPANY.website}  |  ${COMPANY.email}  |  ${COMPANY.phone}`, MARGIN, y + 22, { lineBreak: false });
  const pageLabel = `Page ${pageIndex} of ${totalPages}`;
  doc.font(F.semibold).fontSize(7.5).fillColor("#9CA3AF").text(pageLabel, PAGE_WIDTH - MARGIN - doc.widthOfString(pageLabel), y + 22, { lineBreak: false });
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
      // bufferPages keeps every page buffered until doc.end() so the footer can
      // be redrawn on all pages with the correct "Page X of Y" numbering.
      const doc = new PDFDocument({
        size: "A4",
        margin: { top: 40, left: MARGIN, right: MARGIN, bottom: BOTTOM_MARGIN },
        bufferPages: true,
      });
      if (HAS_INTER) {
        doc.registerFont(F.regular, FONT_FILES.regular);
        doc.registerFont(F.medium, FONT_FILES.medium);
        doc.registerFont(F.semibold, FONT_FILES.semibold);
        doc.registerFont(F.bold, FONT_FILES.bold);
      }
      const stream = fs.createWriteStream(tmpPath);

      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      doc.pipe(stream);
      drawHeader(doc, invoice);
      doc.y = CONTENT_TOP;

      drawInfoCard(doc, invoice);
      drawProject(doc, invoice);
      drawItemsTable(doc, invoice);
      drawNotesAndSummary(doc, invoice);

      // Keep Terms & Conditions + Signature together on one page: only move them
      // to the next page when they genuinely do not fit the remaining space.
      ensureSpace(doc, computeTermsHeight(doc, invoice) + SIGNATURE_HEIGHT);
      drawTerms(doc, invoice);
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
