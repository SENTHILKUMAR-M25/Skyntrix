// Shared metadata for the Requirement Collection feature.
// Mirrors server/models/Requirement.model.js.

export const REQUIREMENT_STATUS = [
  { value: "draft", label: "Draft" },
  { value: "collected", label: "Collected" },
  { value: "under_review", label: "Under Review" },
  { value: "ready_for_quotation", label: "Ready for Quotation" },
];

export const REQUIREMENT_STATUS_MAP = Object.fromEntries(REQUIREMENT_STATUS.map((s) => [s.value, s]));

export const REQUIREMENT_STATUS_BADGE = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  collected: "bg-cyan-100 text-cyan-700 border-cyan-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  ready_for_quotation: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const REQUIREMENT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const PROJECT_TYPES = [
  "Website Development",
  "E-commerce Website",
  "Mobile App",
  "Web Application",
  "CRM",
  "Admin Panel",
  "UI/UX Design",
  "Digital Marketing",
  "SEO",
  "Other",
];

// Contact-centric sales pipeline (mirrors server contactPipeline.service).
export const CONTACT_PIPELINE_STAGES = [
  { value: "lead", label: "Lead", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500", solid: "bg-sky-500" },
  { value: "contact", label: "Contact", badge: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", solid: "bg-indigo-500" },
  { value: "requirement_collected", label: "Requirement Collected", badge: "bg-cyan-100 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", solid: "bg-cyan-500" },
  { value: "ready_for_quotation", label: "Ready for Quotation", badge: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500", solid: "bg-violet-500" },
  { value: "quotation_created", label: "Quotation Created", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", solid: "bg-amber-500" },
  { value: "quotation_accepted", label: "Quotation Accepted", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", solid: "bg-emerald-500" },
  { value: "invoice_created", label: "Invoice Created", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", solid: "bg-blue-500" },
  { value: "payment", label: "Payment", badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", solid: "bg-green-500" },
  { value: "completed", label: "Completed", badge: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500", solid: "bg-teal-500" },
];

export const CONTACT_PIPELINE_MAP = Object.fromEntries(CONTACT_PIPELINE_STAGES.map((s) => [s.value, s]));

export const CONTACT_STAGE_VALUES = CONTACT_PIPELINE_STAGES.map((s) => s.value);

export const CONTACT_CHANNELS = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

export const contactStageMeta = (stage) =>
  CONTACT_PIPELINE_MAP[stage] || {
    value: stage,
    label: String(stage || "—").replace(/_/g, " "),
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    solid: "bg-slate-400",
  };

export const contactStageIndex = (stage) => CONTACT_PIPELINE_STAGES.findIndex((s) => s.value === stage);

export const contactProgressPercent = (stage) => {
  const i = contactStageIndex(stage);
  if (i === -1) return 0;
  return Math.min(100, Math.round((i / (CONTACT_PIPELINE_STAGES.length - 1)) * 100));
};

export const formatMoney = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export const fullDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

export const formatMobileNumber = (mobile = "") => {
  const digits = String(mobile).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return String(mobile || "");
};

export const requirementSummary = (req) => {
  if (!req) return "—";
  return req.projectName || req.projectType || req.businessName || "Requirement";
};

export const requirementEstimate = (req) => {
  if (!req) return 0;
  return Math.max(0, Number(req.estimatedDevelopmentCost) || 0) + Math.max(0, Number(req.estimatedMaintenanceCost) || 0);
};
