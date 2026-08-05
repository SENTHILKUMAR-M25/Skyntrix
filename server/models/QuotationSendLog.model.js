import mongoose from "mongoose";

export const SEND_LOG_STATUS = ["success", "failed", "fallback", "template"];
export const SEND_METHOD = ["api", "web"];
export const DELIVERY_STATUS = ["pending", "sent", "delivered", "read", "failed"];
export const MESSAGE_TYPE = ["text", "document", "template"];

const quotationSendLogSchema = new mongoose.Schema(
  {
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true, index: true },
    quotationNumber: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: SEND_LOG_STATUS, required: true, index: true },
    method: { type: String, enum: SEND_METHOD, default: "api" },
    // Which physical message this log represents: "text", "document", "template".
    messageType: { type: String, enum: MESSAGE_TYPE, default: "text" },
    // True when a template was sent to initiate a conversation and the follow-up
    // (text + PDF document) is waiting for the customer to reply. Cleared once
    // the webhook processes the customer's reply.
    awaitingReply: { type: Boolean, default: false },
    // Delivery lifecycle: "sent" (accepted by WhatsApp), "delivered"/"read"
    // (requires the status webhook), "pending" (wa.me fallback), "failed".
    deliveryStatus: { type: String, enum: DELIVERY_STATUS, default: "pending", index: true },
    sentAt: { type: Date, default: null },
    waUrl: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    documentMessageId: { type: String, default: "" },
    templateMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    isRetry: { type: Boolean, default: false },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    sentByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

quotationSendLogSchema.index({ quotationId: 1, createdAt: -1 });
quotationSendLogSchema.index({ status: 1, createdAt: -1 });
quotationSendLogSchema.index({ deliveryStatus: 1, sentAt: -1 });
quotationSendLogSchema.index({ mobileNumber: 1, awaitingReply: 1, createdAt: -1 });
quotationSendLogSchema.index({ providerMessageId: 1 });
quotationSendLogSchema.index({ documentMessageId: 1 });
quotationSendLogSchema.index({ templateMessageId: 1 });

const QuotationSendLog = mongoose.model("QuotationSendLog", quotationSendLogSchema);
export default QuotationSendLog;
