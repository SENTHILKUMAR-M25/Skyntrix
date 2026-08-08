import LeadContact, { CONTACT_PIPELINE_STAGES } from "../models/LeadContact.model.js";
import Requirement from "../models/Requirement.model.js";
import Quotation from "../models/Quotation.model.js";
import Invoice from "../models/Invoice.model.js";

// Ordered contact pipeline metadata. Mirrors CONTACT_PIPELINE_STAGES.
export const CONTACT_PIPELINE = [
  { stage: "lead", label: "Lead", color: "sky" },
  { stage: "contact", label: "Contact", color: "indigo" },
  { stage: "requirement_collected", label: "Requirement Collected", color: "cyan" },
  { stage: "ready_for_quotation", label: "Ready for Quotation", color: "violet" },
  { stage: "quotation_created", label: "Quotation Created", color: "amber" },
  { stage: "quotation_accepted", label: "Quotation Accepted", color: "emerald" },
  { stage: "invoice_created", label: "Invoice Created", color: "blue" },
  { stage: "payment", label: "Payment", color: "green" },
  { stage: "completed", label: "Completed", color: "teal" },
];

export const contactStageIndex = (stage) => CONTACT_PIPELINE_STAGES.indexOf(stage);

export const contactStageMeta = (stage) =>
  CONTACT_PIPELINE.find((s) => s.stage === stage) || {
    stage,
    label: String(stage || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—",
    color: "slate",
  };

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Derive the current sales-pipeline stage for a contact from the linked
 * requirement / quotation / invoice / payment records. The stage is the most
 * advanced step the data supports, so admin actions automatically advance the
 * pipeline without manual bookkeeping.
 */
export const deriveContactPipelineStage = async (contactId) => {
  if (!contactId) return "lead";

  const contact = await LeadContact.findById(contactId).select(
    "contactedAt contactDate"
  ).lean();
  if (!contact) return "lead";

  let stageIdx = 0; // lead

  // Contact reached: the Skyntrix team has been in touch.
  if (contact.contactedAt || contact.contactDate) stageIdx = Math.max(stageIdx, 1);

  // Requirement collected / ready for quotation.
  const requirement = await Requirement.findOne({ contactId }).sort({ updatedAt: -1 }).select("status").lean();
  if (requirement) {
    stageIdx = Math.max(stageIdx, requirement.status === "ready_for_quotation" ? 3 : 2);
  }

  // Quotation created / accepted.
  const quotations = await Quotation.find({ contactId, status: { $ne: "failed" } })
    .select("acceptanceStatus totalAmount").lean();
  if (quotations.length) {
    stageIdx = Math.max(stageIdx, quotations.some((q) => q.acceptanceStatus === "accepted") ? 5 : 4);
  }

  // Invoice created / payments received.
  const invoices = await Invoice.find({ contactId, status: { $ne: "cancelled" } })
    .select("totalAmount amountPaid").lean();
  if (invoices.length) {
    stageIdx = Math.max(stageIdx, 6);
    const invoiced = round2(invoices.reduce((a, i) => a + (Number(i.totalAmount) || 0), 0));
    const paid = round2(invoices.reduce((a, i) => a + (Number(i.amountPaid) || 0), 0));
    if (paid > 0) {
      stageIdx = Math.max(stageIdx, paid >= invoiced && invoiced > 0 ? 8 : 7);
    }
  }

  return CONTACT_PIPELINE_STAGES[stageIdx] || "lead";
};

/**
 * Persist the derived pipeline stage on the contact (best effort). Call after
 * any action that could move a contact along: contact saved, requirement
 * saved/status change, quotation created/accepted, invoice created, payment.
 */
export const syncContactPipelineStage = async (contactId) => {
  if (!contactId) return null;
  try {
    const stage = await deriveContactPipelineStage(contactId);
    const contact = await LeadContact.findById(contactId);
    if (!contact) return null;
    if (contact.pipelineStage !== stage) {
      contact.pipelineStage = stage;
      await contact.save();
    }
    return contact;
  } catch (err) {
    return null;
  }
};
