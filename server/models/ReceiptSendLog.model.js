import mongoose from "mongoose";

export const RECEIPT_SEND_CHANNEL = ["whatsapp", "email"];
export const RECEIPT_SEND_STATUS = ["success", "failed", "fallback", "template"];
export const RECEIPT_DELIVERY_STATUS = ["pending", "sent", "delivered", "read", "failed"];
export const RECEIPT_MESSAGE_TYPE = ["text", "document", "template"];

const receiptSendLogSchema = new mongoose.Schema(
  {
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: "Receipt", required: true, index: true },
    receiptNumber: { type: String, trim: true, default: "" },
    invoiceNumber: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    channel: { type: String, enum: RECEIPT_SEND_CHANNEL, default: "whatsapp", index: true },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: RECEIPT_SEND_STATUS, required: true, index: true },
    messageType: { type: String, enum: RECEIPT_MESSAGE_TYPE, default: "text" },
    awaitingReply: { type: Boolean, default: false },
    deliveryStatus: { type: String, enum: RECEIPT_DELIVERY_STATUS, default: "pending" },
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

receiptSendLogSchema.index({ receiptId: 1, createdAt: -1 });
receiptSendLogSchema.index({ status: 1, createdAt: -1 });
receiptSendLogSchema.index({ mobileNumber: 1, awaitingReply: 1, createdAt: -1 });
receiptSendLogSchema.index({ providerMessageId: 1 });
receiptSendLogSchema.index({ documentMessageId: 1 });
receiptSendLogSchema.index({ templateMessageId: 1 });

const ReceiptSendLog = mongoose.model("ReceiptSendLog", receiptSendLogSchema);
export default ReceiptSendLog;
