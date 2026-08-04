// Shared helpers for the Lead Contact module.

export const LEAD_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export const WHATSAPP_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export const FOLLOW_UP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "follow-up", label: "Follow-up" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
];

export const SEND_LOG_STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "fallback", label: "Opened (Web)" },
  { value: "failed", label: "Failed" },
];

export const WEBSITE_URL = "https://skyntrix.vercel.app/";

const TEMPLATE = `👋 Hello!
Thank you for your interest in Skyntrix.
━━━━━━━━━━━━━━━━━━
🏢 Business Name
{businessName}
📝 Summary
{summary}
🌐 Demo
{demoLink}
💻 Website
{websiteLink}
━━━━━━━━━━━━━━━━━━
We specialize in:
✅ Business Websites
✅ Restaurant Websites
✅ Hotel Websites
✅ Parking Management Systems
✅ CRM Software
✅ ERP Solutions
✅ Mobile Applications
✅ Custom Web Applications
If you'd like a free consultation or live demo, simply reply to this message.
Thank you!
Regards,
Skyntrix Team`;

export const buildWhatsAppMessage = (lead, website = WEBSITE_URL) => {
  const fill = (v, fallback) => (v && String(v).trim() ? String(v).trim() : fallback);
  return TEMPLATE.replace("{businessName}", fill(lead.businessName, "—"))
    .replace("{summary}", fill(lead.summary, "—"))
    .replace("{demoLink}", fill(lead.demoLink, "—"))
    .replace("{websiteLink}", fill(lead.websiteLink, website));
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

export const waMeUrl = (mobileNumber, message) => {
  const digits = normalizeMobileNumber(mobileNumber);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

export const ensureProtocol = (url) => {
  if (!url || !String(url).trim()) return "";
  const value = String(url).trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const isValidUrl = (url) => {
  if (!url) return true;
  try {
    const parsed = new URL(ensureProtocol(url));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const fullDateTime = (date) =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
