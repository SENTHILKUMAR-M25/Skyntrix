import mongoose from "mongoose";

export const SEND_LOG_STATUS = ["success", "failed", "fallback"];
export const SEND_METHOD = ["api", "web"];

const whatsAppSendLogSchema = new mongoose.Schema(
  {
    leadContactId: { type: mongoose.Schema.Types.ObjectId, ref: "LeadContact", required: true, index: true },
    businessName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: SEND_LOG_STATUS, required: true, index: true },
    method: { type: String, enum: SEND_METHOD, default: "api" },
    waUrl: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    isRetry: { type: Boolean, default: false },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    sentByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

whatsAppSendLogSchema.index({ leadContactId: 1, createdAt: -1 });
whatsAppSendLogSchema.index({ status: 1, createdAt: -1 });

const WhatsAppSendLog = mongoose.model("WhatsAppSendLog", whatsAppSendLogSchema);
export default WhatsAppSendLog;
