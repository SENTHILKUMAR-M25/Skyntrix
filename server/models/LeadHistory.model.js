import mongoose from "mongoose";
import { LEAD_STATUS } from "./Lead.model.js";

export const LEAD_ACTIVITY_ACTIONS = [
  "stage_change",
  "note",
  "reminder_added",
  "reminder_completed",
  "attachment_added",
  "attachment_deleted",
  "quotation_created",
  "quotation_approved",
  "invoice_created",
  "payment_recorded",
  "lead_updated",
];

const leadHistorySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    action: { type: String, enum: LEAD_ACTIVITY_ACTIONS, default: "note" },
    title: { type: String, trim: true, default: "" },
    previousStatus: { type: String, enum: LEAD_STATUS, default: null },
    newStatus: { type: String, enum: LEAD_STATUS, default: null, index: true },
    note: { type: String, default: "", trim: true, maxlength: 1000 },
    amount: { type: Number, default: null },
    reminderAt: { type: Date, default: null },
    attachment: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System", trim: true },
    createdByAvatar: { type: String, default: "" },
  },
  { timestamps: true }
);

leadHistorySchema.index({ leadId: 1, createdAt: -1 });
leadHistorySchema.index({ leadId: 1, newStatus: 1, createdAt: -1 });

const LeadHistory = mongoose.model("LeadHistory", leadHistorySchema);
export default LeadHistory;
