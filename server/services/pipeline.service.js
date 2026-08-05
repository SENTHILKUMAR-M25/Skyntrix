import Lead, { LEAD_STAGES, LEAD_TERMINAL_STAGE, LEAD_LEGACY_STAGE } from "../models/Lead.model.js";
import LeadHistory from "../models/LeadHistory.model.js";
import { invalidateChartsCache } from "../controllers/dashboard.controller.js";

// Ordered pipeline metadata shared by the board, badges and auto-sync logic.
export const PIPELINE_STAGES = [
  { stage: "new", label: "Lead", phase: "Lead", color: "sky" },
  { stage: "contacted", label: "Contacted", phase: "Lead", color: "indigo" },
  { stage: "meeting_scheduled", label: "Meeting Scheduled", phase: "Lead", color: "violet" },
  { stage: "requirement_collected", label: "Requirement Collected", phase: "Lead", color: "cyan" },
  { stage: "quotation_sent", label: "Quotation Sent", phase: "Proposal", color: "amber" },
  { stage: "follow_up", label: "Follow-up", phase: "Proposal", color: "orange" },
  { stage: "approved", label: "Approved", phase: "Proposal", color: "emerald" },
  { stage: "advance_received", label: "Advance Received", phase: "Onboarding", color: "green" },
  { stage: "agreement_signed", label: "Agreement Signed", phase: "Onboarding", color: "teal" },
  { stage: "project_started", label: "Project Started", phase: "Execution", color: "cyan" },
  { stage: "design_approval", label: "Design Approval", phase: "Execution", color: "fuchsia" },
  { stage: "development", label: "Development", phase: "Execution", color: "purple" },
  { stage: "testing", label: "Testing", phase: "Execution", color: "pink" },
  { stage: "final_payment", label: "Final Payment", phase: "Delivery", color: "yellow" },
  { stage: "delivered", label: "Delivered", phase: "Delivery", color: "emerald" },
  { stage: "support", label: "Support / Maintenance", phase: "Delivery", color: "slate" },
];

export const TERMINAL_STAGE = LEAD_TERMINAL_STAGE;
export const LEGACY_STAGE = LEAD_LEGACY_STAGE;

export const STAGE_ORDER = [...LEAD_STAGES, LEAD_TERMINAL_STAGE, LEAD_LEGACY_STAGE];

export const stageIndex = (stage) => LEAD_STAGES.indexOf(stage);

export const stageMeta = (stage) => PIPELINE_STAGES.find((s) => s.stage === stage) || {
  stage,
  label: String(stage || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—",
  phase: "Other",
  color: "slate",
};

/**
 * Persist a single activity entry on a lead's timeline. Newer callers pass an
 * explicit `action`; the entry keeps the lead's current stage so it stays
 * visible when the timeline is filtered by stage.
 */
export const recordLeadActivity = async ({ leadId, action = "note", title = "", note = "", amount, reminderAt, attachment, actor = {} }) => {
  const lead = await Lead.findById(leadId).select("status").lean();
  const stage = lead?.status || null;
  const { createdBy = null, createdByName = "System", createdByAvatar = "" } = actor || {};
  return LeadHistory.create({
    leadId,
    action,
    title: title || note || "",
    previousStatus: stage,
    newStatus: stage,
    note: note || title || "",
    amount: amount ?? undefined,
    reminderAt: reminderAt ?? undefined,
    attachment: attachment ?? undefined,
    createdBy,
    createdByName,
    createdByAvatar,
  });
};

/**
 * Move a lead forward/backward in the pipeline. Auto-sync callers use
 * `forwardOnly: true` so quotations/invoices never regress a lead.
 * Writes the stage transition + an activity entry to the timeline.
 */
export const moveLeadStage = async ({ lead, newStage, actor = {}, note = "", action = "stage_change", title = "", forwardOnly = false }) => {
  if (!lead || !newStage) return lead;
  const current = lead.status;

  if (current === newStage) {
    await recordLeadActivity({ leadId: lead._id, action, title, note, actor });
    invalidateChartsCache();
    return lead;
  }

  if (forwardOnly) {
    const from = stageIndex(current);
    const to = stageIndex(newStage);
    if (from > to) {
      await recordLeadActivity({ leadId: lead._id, action, title, note, actor });
      invalidateChartsCache();
      return lead;
    }
  }

  const now = new Date();
  if (!Array.isArray(lead.stageLog)) lead.stageLog = [];
  const last = lead.stageLog[lead.stageLog.length - 1];
  if (last && last.stage === current && !last.leftAt) last.leftAt = now;
  lead.stageLog.push({ stage: newStage, enteredAt: now });
  lead.status = newStage;
  lead.stageEnteredAt = now;
  await lead.save();

  await recordLeadActivity({
    leadId: lead._id,
    action,
    title,
    note,
    previousStatus: current,
    newStatus: newStage,
    actor,
  });
  invalidateChartsCache();
  return lead;
};

/**
 * Compute a lead's lifetime in a given stage (for cycle-time reporting).
 * Returns null when there is no matching stage entry.
 */
export const stageDuration = (lead, stage) => {
  const entry = (lead.stageLog || []).find((e) => e.stage === stage);
  if (!entry) return null;
  const start = new Date(entry.enteredAt).getTime();
  const end = entry.leftAt ? new Date(entry.leftAt).getTime() : Date.now();
  return Math.max(0, end - start);
};

export const pipelineStageList = () => [...LEAD_STAGES, LEAD_TERMINAL_STAGE, LEAD_LEGACY_STAGE];
