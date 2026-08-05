// Shared helpers for the Payment Receipt module.
import api from "../api";

export const RECEIPT_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "paidOn:desc", label: "Payment date (newest)" },
  { value: "clientName:asc", label: "Client name (A-Z)" },
  { value: "amountReceived:desc", label: "Amount received (high-low)" },
  { value: "amountReceived:asc", label: "Amount received (low-high)" },
];

export const RECEIPT_PAYMENT_METHOD_OPTIONS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const SEND_CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "both", label: "WhatsApp + Email" },
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

export const formatMobileNumber = (value) => {
  const digits = normalizeMobileNumber(value);
  if (!digits) return value || "—";
  const national = digits.slice(2);
  const groups = national.match(/^(\d{5})(\d{5})$/) || [national];
  return `+91 ${groups[1]} ${groups[2]}`;
};

/** Client-side mirror of the server's WhatsApp message so admins can preview. */
export const buildReceiptMessagePreview = (receipt, { includePdfLink = false } = {}) => {
  const name = (receipt.clientName || "").trim() || "there";
  const amount = Number(receipt.amountReceived || 0).toLocaleString("en-IN");
  const paidTill = Number(receipt.totalPaidTillDate || 0).toLocaleString("en-IN");
  const balance = Number(receipt.remainingBalance || 0).toLocaleString("en-IN");
  const project = (receipt.projectName || "").trim() || "—";
  const lines = [
    `Hello ${name},`,
    "",
    "Thank you for choosing Skyntrix Technologies.",
    "",
    "We confirm receipt of your payment. Please find your payment receipt attached.",
    "",
    `Receipt No: ${receipt.receiptNumber || "—"}`,
    `Invoice No: ${receipt.invoiceNumber || "—"}`,
    `Project: ${project}`,
    `Amount Received: ₹${amount}`,
    `Total Paid Till Date: ₹${paidTill}`,
    `Remaining Balance: ₹${balance}`,
    `Payment Date: ${formatDate(receipt.paidOn)}`,
  ];
  if (includePdfLink && receipt.pdfUrl) lines.push("", `Download PDF: ${receipt.pdfUrl}`);
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

/** Download the receipt PDF as a file (auth attached via the api client). */
export const downloadReceiptPdf = async (id, filename = "receipt.pdf") => {
  const blob = await api.get(`/receipts/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
