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


/**
 * Unicode emoji + box-drawing constants.
 *
 * IMPORTANT: Every emoji is declared as a Unicode code-point escape (`\u{...}`)
 * instead of a literal emoji character, so the source file only contains ASCII
 * bytes. This makes the template immune to corruption when a file is saved or
 * read with a non-UTF-8 encoding (e.g. Windows-1252 / Latin-1), which is what
 * turns emojis into the U+FFFD replacement character (`�`).
 */
const EMOJI = {
  wave: "\u{1F44B}",            // 👋
  building: "\u{1F3E2}",        // 🏢
  memo: "\u{1F4DD}",            // 📝
  demo: "\u{1F3A5}",            // 🎥
  globe: "\u{1F310}",           // 🌐
  plate: "\u{1F37D}\u{FE0F}",   // 🍽️
  car: "\u{1F697}",             // 🚗
  chart: "\u{1F4CA}",           // 📊
  phone: "\u{1F4F1}",           // 📱
  briefcase: "\u{1F4BC}",       // 💼
  sparkle: "\u{2728}",          // ✨
  heavyMinus: "\u{2501}",       // ━
};

/** ━━━━━━━━━━━━━━━━━━ (18 heavy horizontal lines) */
const RULE = EMOJI.heavyMinus.repeat(18);

const TEMPLATE = `${EMOJI.wave} Hello!

Thank you for your interest in Skyntrix.

_________________

🏢 Business Name
{businessName}

📝 About Your Project
{summary}

🌐 Live Demo
{demoLink}

🏢  Our Website
{websiteLink}



At Skyntrix, we build modern, scalable, and business-focused digital solutions, including:

✅ Business Websites
✅ Restaurant Websites
✅ Hotel Websites
✅ E-Commerce Websites
✅ Parking Management Systems
✅ CRM Software
✅ ERP Solutions
✅ Mobile Applications
✅ Custom Web Applications
Simply reply to this message, and our team will get in touch with you.

_________________________

Best Regards,

Skyntrix Team
Building Smart Digital Solutions

🌐 {websiteLink}
`;

const REPLACEMENT_CHAR = "\uFFFD";

/**
 * Self-heal a template corrupted by a non-UTF-8 read/write (see EMOJI).
 * Each U+FFFD (`�`) is matched by its surrounding text and restored to the
 * correct emoji; uncorrupted messages pass through unchanged.
 */
const repairCorruptedEmojis = (message) => {
  if (!message || !message.includes(REPLACEMENT_CHAR)) return message;

  let repaired = message;
  const repairs = [
    [/\uFFFD+\s*Hello!/, `${EMOJI.wave} Hello!`],
    [/\uFFFD+\s*Business Name/, `${EMOJI.building} Business Name`],
    [/\uFFFD+\s*About Your Project/, `${EMOJI.memo} About Your Project`],
    [/\uFFFD+\s*Live Demo/, `${EMOJI.demo} Live Demo`],
    [/\uFFFD+\s*Our Website/, `${EMOJI.globe} Our Website`],
    [/\uFFFD+\s*Business & Corporate Websites/, `${EMOJI.globe} Business & Corporate Websites`],
    [/\uFFFD+\s*Restaurant & Hotel Websites/, `${EMOJI.plate} Restaurant & Hotel Websites`],
    [/\uFFFD+\s*Parking Management Systems/, `${EMOJI.car} Parking Management Systems`],
    [/\uFFFD+\s*CRM & ERP Software/, `${EMOJI.chart} CRM & ERP Software`],
    [/\uFFFD+\s*Mobile Applications/, `${EMOJI.phone} Mobile Applications`],
    [/\uFFFD+\s*Custom Web Applications/, `${EMOJI.briefcase} Custom Web Applications`],
    [/\uFFFD+\s*We'd be happy/, `${EMOJI.sparkle} We'd be happy`],
    [/\uFFFD+\s*\{websiteLink\}/, `${EMOJI.globe} {websiteLink}`],
  ];
  for (const [pattern, fixed] of repairs) {
    repaired = repaired.replace(pattern, fixed);
  }

  repaired = repaired.replace(/^[\uFFFD]+$/gm, RULE);

  return repaired;
};

const TEMPLATE_PLACEHOLDERS = ["{businessName}", "{summary}", "{demoLink}", "{websiteLink}"];

export const buildWhatsAppMessage = (lead, website = WEBSITE_URL) => {
  const fill = (v, fallback) => (v && String(v).trim() ? String(v).trim() : fallback);
  const values = [
    fill(lead.businessName, "\u2014"),
    fill(lead.summary, "\u2014"),
    fill(lead.demoLink, "\u2014"),
    fill(lead.websiteLink, website),
  ];
  return TEMPLATE_PLACEHOLDERS.reduce(
    (template, token, i) => template.split(token).join(values[i]),
    repairCorruptedEmojis(TEMPLATE)
  );
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
