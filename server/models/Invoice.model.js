import mongoose from "mongoose";

export const INVOICE_STATUS = ["draft", "sent", "paid", "cancelled"];
export const INVOICE_PAYMENT_STATUS = ["pending", "partial", "paid", "overdue"];
export const INVOICE_TYPES = ["advance", "partial", "final", "full"];
export const INVOICE_DISCOUNT_TYPES = ["flat", "percent"];
export const PAYMENT_METHODS = ["bank_transfer", "upi", "cash", "cheque", "card", "other"];

const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const invoicePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    reference: { type: String, trim: true, default: "" },
    paidOn: { type: Date, default: () => new Date() },
    note: { type: String, trim: true, default: "" },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    receivedByName: { type: String, default: "System" },
  },
  { _id: true, timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null },
    quotationNumber: { type: String, trim: true, default: "" },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    type: { type: String, enum: INVOICE_TYPES, default: "full" },

    clientName: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true, default: "" },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "", lowercase: true },
    billingAddress: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, default: "" },

    projectName: { type: String, required: true, trim: true },
    projectDescription: { type: String, trim: true, default: "" },
    items: { type: [invoiceItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: INVOICE_DISCOUNT_TYPES, default: "flat" },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    // Cumulative project payment tracking (reference = approved quotation total).
    projectTotal: { type: Number, default: 0 },
    previousPaid: { type: Number, default: 0 },
    totalPaidTillDate: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },

    invoiceDate: { type: Date, default: () => new Date() },
    dueDate: { type: Date, default: null },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    paymentStatus: { type: String, enum: INVOICE_PAYMENT_STATUS, default: "pending" },
    notes: { type: String, trim: true, default: "" },
    terms: { type: String, trim: true, default: "" },

    pdfUrl: { type: String, default: "" },
    pdfPath: { type: String, default: "" },

    status: { type: String, enum: INVOICE_STATUS, default: "draft" },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    payments: { type: [invoicePaymentSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

// Duplicate prevention: at most one invoice per (quotation, type).
invoiceSchema.index(
  { quotationId: 1, type: 1 },
  { unique: true, partialFilterExpression: { quotationId: { $type: "objectId" } } }
);
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ paymentStatus: 1, dueDate: 1 });
invoiceSchema.index({ leadId: 1, createdAt: -1 });
invoiceSchema.index({
  clientName: "text",
  businessName: "text",
  email: "text",
  mobile: "text",
  projectName: "text",
  invoiceNumber: "text",
  quotationNumber: "text",
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
