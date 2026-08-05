import mongoose from "mongoose";

export const WHATSAPP_STATUS = ["pending", "sent", "awaiting_reply", "failed"];
export const QUOTATION_STATUS = ["draft", "sent", "failed"];

const serviceItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    clientName: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true, default: "" },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "", lowercase: true },
    projectName: { type: String, required: true, trim: true },
    projectDescription: { type: String, trim: true, default: "" },
    services: { type: [serviceItemSchema], default: [] },
    projectTimeline: { type: String, trim: true, default: "" },
    paymentTerms: { type: String, trim: true, default: "" },
    advanceAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    additionalNotes: { type: String, trim: true, default: "" },
    validUntil: { type: Date, default: null },

    pdfUrl: { type: String, default: "" },
    pdfPath: { type: String, default: "" },
    whatsappStatus: { type: String, enum: WHATSAPP_STATUS, default: "pending" },
    status: { type: String, enum: QUOTATION_STATUS, default: "draft" },
    sentAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

quotationSchema.index({ clientName: "text", businessName: "text", email: "text", mobile: "text", projectName: "text", quotationNumber: "text" });
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ whatsappStatus: 1, createdAt: -1 });
quotationSchema.index({ sentAt: -1 });

const Quotation = mongoose.model("Quotation", quotationSchema);
export default Quotation;
