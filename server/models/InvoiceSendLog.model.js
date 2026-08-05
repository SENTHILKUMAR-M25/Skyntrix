import mongoose from "mongoose";

export const SEND_CHANNEL = ["whatsapp", "email"];
export const SEND_STATUS = ["success", "failed", "fallback", "template"];
export const DELIVERY_STATUS = ["pending", "sent", "delivered", "read", "failed"];
export const MESSAGE_TYPE = ["text", "document", "template"];

const invoiceSendLogSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    invoiceNumber: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    channel: { type: String, enum: SEND_CHANNEL, default: "whatsapp", index: true },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: SEND_STATUS, required: true, index: true },
    // Which physical message this log represents: "text", "document", "template".
    messageType: { type: String, enum: MESSAGE_TYPE, default: "text" },
    // True when a template was sent to initiate a conversation and the follow-up
    // (text + PDF document) is waiting for the customer to reply. Cleared once
    // the webhook processes the customer's reply.
    awaitingReply: { type: Boolean, default: false },
    deliveryStatus: { type: String, enum: DELIVERY_STATUS, default: "pending" },
    sentAt: { type: Date, default: null },
    waUrl: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    documentMessageId: { type: String, default: "" },
    templateMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    isReminder: { type: Boolean, default: false },
    isRetry: { type: Boolean, default: false },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    sentByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

invoiceSendLogSchema.index({ invoiceId: 1, createdAt: -1 });
invoiceSendLogSchema.index({ status: 1, createdAt: -1 });
invoiceSendLogSchema.index({ mobileNumber: 1, awaitingReply: 1, createdAt: -1 });
invoiceSendLogSchema.index({ providerMessageId: 1 });
invoiceSendLogSchema.index({ documentMessageId: 1 });
invoiceSendLogSchema.index({ templateMessageId: 1 });

const InvoiceSendLog = mongoose.model("InvoiceSendLog", invoiceSendLogSchema);
export default InvoiceSendLog;
