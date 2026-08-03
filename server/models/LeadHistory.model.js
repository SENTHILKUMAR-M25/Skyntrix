import mongoose from "mongoose";
import { LEAD_STATUS } from "./Lead.model.js";

const leadHistorySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    previousStatus: { type: String, enum: LEAD_STATUS, default: "new" },
    newStatus: { type: String, enum: LEAD_STATUS, required: true, index: true },
    note: { type: String, default: "", trim: true, maxlength: 1000 },
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
