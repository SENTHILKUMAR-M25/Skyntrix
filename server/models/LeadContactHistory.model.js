import mongoose from "mongoose";

export const LEAD_CONTACT_ACTIONS = [
  "create",
  "update",
  "send",
  "resend",
  "status",
  "note",
  "follow-up",
  "assign",
  "delete",
];

const leadContactHistorySchema = new mongoose.Schema(
  {
    leadContactId: { type: mongoose.Schema.Types.ObjectId, ref: "LeadContact", required: true, index: true },
    action: { type: String, enum: LEAD_CONTACT_ACTIONS, required: true, index: true },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System", trim: true },
  },
  { timestamps: true }
);

leadContactHistorySchema.index({ leadContactId: 1, createdAt: -1 });

const LeadContactHistory = mongoose.model("LeadContactHistory", leadContactHistorySchema);
export default LeadContactHistory;
