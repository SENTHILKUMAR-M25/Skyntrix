// Shared pipeline metadata used by the Kanban board, lead profile and badges.
// Mirrors server/models/Lead.model.js LEAD_STAGES.

export const PIPELINE_STAGES = [
  { value: "new", label: "Lead", phase: "Lead", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500", solid: "bg-sky-500" },
  { value: "contacted", label: "Contacted", phase: "Lead", badge: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", solid: "bg-indigo-500" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", phase: "Lead", badge: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500", solid: "bg-violet-500" },
  { value: "requirement_collected", label: "Requirement Collected", phase: "Lead", badge: "bg-cyan-100 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", solid: "bg-cyan-500" },
  { value: "quotation_sent", label: "Quotation Sent", phase: "Proposal", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", solid: "bg-amber-500" },
  { value: "follow_up", label: "Follow-up", phase: "Proposal", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", solid: "bg-orange-500" },
  { value: "approved", label: "Approved", phase: "Proposal", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", solid: "bg-emerald-500" },
  { value: "advance_received", label: "Advance Received", phase: "Onboarding", badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", solid: "bg-green-500" },
  { value: "agreement_signed", label: "Agreement Signed", phase: "Onboarding", badge: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500", solid: "bg-teal-500" },
  { value: "project_started", label: "Project Started", phase: "Execution", badge: "bg-cyan-100 text-cyan-700 border-cyan-200", dot: "bg-cyan-600", solid: "bg-cyan-600" },
  { value: "design_approval", label: "Design Approval", phase: "Execution", badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", dot: "bg-fuchsia-500", solid: "bg-fuchsia-500" },
  { value: "development", label: "Development", phase: "Execution", badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", solid: "bg-purple-500" },
  { value: "testing", label: "Testing", phase: "Execution", badge: "bg-pink-100 text-pink-700 border-pink-200", dot: "bg-pink-500", solid: "bg-pink-500" },
  { value: "final_payment", label: "Final Payment", phase: "Delivery", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", solid: "bg-yellow-500" },
  { value: "delivered", label: "Delivered", phase: "Delivery", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-600", solid: "bg-emerald-600" },
  { value: "support", label: "Support / Maintenance", phase: "Delivery", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", solid: "bg-slate-400" },
];

export const TERMINAL_STAGES = [
  { value: "closed", label: "Closed / Lost", phase: "Terminal", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", solid: "bg-slate-400" },
  { value: "converted", label: "Converted", phase: "Terminal", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", solid: "bg-emerald-400" },
];

export const ALL_STAGES = [...PIPELINE_STAGES, ...TERMINAL_STAGES];
export const STAGE_MAP = Object.fromEntries(ALL_STAGES.map((s) => [s.value, s]));
export const STAGE_VALUES = ALL_STAGES.map((s) => s.value);

export const PRIORITIES = [
  { value: "low", label: "Low", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  { value: "medium", label: "Medium", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { value: "high", label: "High", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  { value: "urgent", label: "Urgent", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
];
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.value, p]));

export const stageMeta = (stage) =>
  STAGE_MAP[stage] || {
    value: stage,
    label: String(stage || "—").replace(/_/g, " "),
    phase: "Other",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    solid: "bg-slate-400",
  };

export const priorityMeta = (priority) =>
  PRIORITY_MAP[priority] || {
    value: priority,
    label: priority || "—",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };

export const stageIndex = (stage) => {
  const i = PIPELINE_STAGES.findIndex((s) => s.value === stage);
  return i === -1 ? 0 : i;
};

export const progressPercent = (stage) => {
  if (!PIPELINE_STAGES.some((s) => s.value === stage)) return 0;
  return Math.min(100, Math.round((stageIndex(stage) / (PIPELINE_STAGES.length - 1)) * 100));
};

export const isOverdue = (dueDate) => !!dueDate && new Date(dueDate).getTime() < Date.now();

export const formatMoney = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export const initials = (name = "") =>
  String(name)
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
