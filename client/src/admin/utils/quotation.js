// Shared helpers for the Quotation module.
import api from "../api";

export const QUOTATION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export const WHATSAPP_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "awaiting_reply", label: "Awaiting reply" },
  { value: "failed", label: "Failed" },
];

export const SEND_LOG_STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "fallback", label: "Opened (Web)" },
  { value: "template", label: "Template (awaiting reply)" },
  { value: "failed", label: "Failed" },
];

export const QUOTATION_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "clientName:asc", label: "Client name (A-Z)" },
  { value: "businessName:asc", label: "Business name (A-Z)" },
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

// Normalize a mobile number to international digits (91XXXXXXXXXX).
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

// Pretty display format: +91 98765 43210
export const formatMobileNumber = (value) => {
  const digits = normalizeMobileNumber(value);
  if (!digits) return value || "—";
  const national = digits.slice(2);
  const groups = national.match(/^(\d{5})(\d{5})$/) || [national];
  return `+91 ${groups[1]} ${groups[2]}`;
};

/**
 * Client-side mirror of the WhatsApp TEXT message the server sends to the
 * client (before the PDF document), so the admin can preview it before sending.
 */
export const buildQuotationMessagePreview = (quotation, { includePdfLink = false } = {}) => {
  const name = (quotation.clientName || "").trim() || "there";
  const total = Number(quotation.totalAmount || 0).toLocaleString("en-IN");
  const project = (quotation.projectName || "").trim() || "—";
  const lines = [
    `Hello ${name},`,
    "",
    "Thank you for choosing Skyntrix Technologies.",
    "",
    "Please find your quotation attached.",
    "",
    `Quotation No: ${quotation.quotationNumber || "—"}`,
    `Project: ${project}`,
    `Total Amount: ₹${total}`,
  ];
  if (includePdfLink && quotation.pdfUrl) lines.push("", `Download PDF: ${quotation.pdfUrl}`);
  lines.push(
    "",
    "If you have any questions or would like any changes, feel free to contact us.",
    "",
    "Regards,",
    "Senthil Kumar",
    "Founder",
    "Skyntrix Technologies"
  );
  return lines.join("\n");
};

export const quoteServicesTotal = (services) =>
  (services || []).reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

/** Download the quotation PDF as a file (auth is attached via the api client). */
export const downloadQuotationPdf = async (id, filename = "quotation.pdf") => {
  const blob = await api.get(`/quotations/${id}/download`, { responseType: "blob" });
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
