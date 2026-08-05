// Shared helpers for the Invoice module.
import api from "../api";

export const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const INVOICE_PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export const INVOICE_TYPE_OPTIONS = [
  { value: "advance", label: "Advance" },
  { value: "partial", label: "Partial" },
  { value: "final", label: "Final" },
  { value: "full", label: "Full" },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: "flat", label: "Flat (₹)" },
  { value: "percent", label: "Percent (%)" },
];

export const SEND_CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "both", label: "WhatsApp + Email" },
];

export const INVOICE_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "dueDate:asc", label: "Due date (soonest)" },
  { value: "clientName:asc", label: "Client name (A-Z)" },
  { value: "totalAmount:desc", label: "Total amount (high-low)" },
  { value: "totalAmount:asc", label: "Total amount (low-high)" },
];

export const formatMoney = (value) => {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-IN")}`;
};

export const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fullDateTime = (date) =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const normalizeMobileNumber = (input) => {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return null;
};

export const isValidMobileNumber = (input) => Boolean(normalizeMobileNumber(input));

export const formatMobileNumber = (value) => {
  const digits = normalizeMobileNumber(value);
  if (!digits) return value || "—";
  const national = digits.slice(2);
  const groups = national.match(/^(\d{5})(\d{5})$/) || [national];
  return `+91 ${groups[1]} ${groups[2]}`;
};

/** Client-side mirror of the server's WhatsApp message so admins can preview. */
export const buildInvoiceMessagePreview = (invoice, { includePdfLink = false } = {}) => {
  const name = (invoice.clientName || "").trim() || "there";
  const total = Number(invoice.totalAmount || 0).toLocaleString("en-IN");
  const paid = Number(invoice.amountPaid || 0).toLocaleString("en-IN");
  const balance = Number(invoice.balanceDue || 0).toLocaleString("en-IN");
  const project = (invoice.projectName || "").trim() || "—";
  const lines = [
    `Hello ${name},`,
    "",
    "Thank you for choosing Skyntrix Technologies.",
    "",
    "Please find your invoice attached.",
    "",
    `Invoice No: ${invoice.invoiceNumber || "—"}`,
    `Project: ${project}`,
    `Total Amount: ₹${total}`,
    `Amount Paid: ₹${paid}`,
    `Balance Due: ₹${balance}`,
    `Due Date: ${formatDate(invoice.dueDate)}`,
  ];
  if (includePdfLink && invoice.pdfUrl) lines.push("", `Download PDF: ${invoice.pdfUrl}`);
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

/** Compute the same finance block the server uses (for instant preview). */
export const computeTotals = (items = [], discount = 0, discountType = "flat", taxRate = 0) => {
  const normalized = (items || []).map((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    return { ...item, quantity, unitPrice, amount: quantity * unitPrice };
  });
  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = discountType === "percent" ? (subtotal * Number(discount)) / 100 : Number(discount) || 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxable * Number(taxRate)) / 100;
  const totalAmount = taxable + taxAmount;
  return { subtotal, discountAmount, taxAmount, totalAmount };
};

/** Download the invoice PDF as a file (auth attached via the api client). */
export const downloadInvoicePdf = async (id, filename = "invoice.pdf") => {
  const blob = await api.get(`/invoices/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const waMeUrl = (mobileNumber, message) => {
  const digits = normalizeMobileNumber(mobileNumber);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

export const isOverdue = (invoice) =>
  invoice?.paymentStatus === "overdue" ||
  (invoice?.status === "sent" && invoice?.balanceDue > 0 && invoice?.dueDate && new Date(invoice.dueDate) < new Date());
