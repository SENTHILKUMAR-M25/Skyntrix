import mongoose from "mongoose";

export const RECEIPT_PAYMENT_METHODS = ["bank_transfer", "upi", "cash", "cheque", "card", "other"];
export const RECEIPT_PAYMENT_STATUS = ["paid"];

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },

    // Links back to the invoice, quotation and lead this receipt certifies.
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },

    // The exact invoice.payments entry this receipt certifies. Used with the
    // unique (invoiceId, paymentEntryId) index to prevent duplicate receipts
    // for the same payment transaction.
    paymentEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Fallback fingerprint for receipts generated without a ledger entry
    // (e.g. an invoice marked paid directly). paymentKey + amount guards the
    // same transaction from being receipted twice.
    paymentKey: { type: String, default: "" },

    invoiceNumber: { type: String, trim: true, default: "" },
    quotationNumber: { type: String, trim: true, default: "" },

    // Client snapshot (auto-fetched from the invoice / quotation).
    clientName: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "", lowercase: true },
    billingAddress: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, default: "" },

    // Project snapshot.
    projectName: { type: String, required: true, trim: true },
    projectDescription: { type: String, trim: true, default: "" },

    // Money block. Project Total and the cumulative figures are derived from
    // the quotation total and the project's payment ledger so every receipt
    // accurately reflects cumulative payments at the time the payment landed.
    projectTotal: { type: Number, default: 0 },
    invoiceAmount: { type: Number, default: 0 },
    previousPayments: { type: Number, default: 0 },
    amountReceived: { type: Number, required: true },
    totalPaidTillDate: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    amountPaidOnInvoice: { type: Number, default: 0 },
    balanceDueOnInvoice: { type: Number, default: 0 },

    // Payment details.
    paymentMethod: { type: String, enum: RECEIPT_PAYMENT_METHODS, default: "bank_transfer" },
    transactionId: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    paidOn: { type: Date, default: () => new Date() },
    paymentStatus: { type: String, enum: RECEIPT_PAYMENT_STATUS, default: "paid" },

    pdfUrl: { type: String, default: "" },
    pdfPath: { type: String, default: "" },

    // Audit trail.
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    generatedByName: { type: String, default: "System" },
    regeneratedAt: { type: Date, default: null },
    regenerationCount: { type: Number, default: 0 },
    resentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Duplicate prevention: at most one receipt per payment transaction per invoice.
receiptSchema.index(
  { invoiceId: 1, paymentEntryId: 1 },
  { unique: true, partialFilterExpression: { paymentEntryId: { $type: "objectId" } } }
);
receiptSchema.index({ quotationId: 1, createdAt: -1 });
receiptSchema.index({ leadId: 1, createdAt: -1 });
receiptSchema.index({ receiptNumber: 1, createdAt: -1 });
receiptSchema.index({
  clientName: "text",
  businessName: "text",
  email: "text",
  mobile: "text",
  projectName: "text",
  receiptNumber: "text",
  invoiceNumber: "text",
  quotationNumber: "text",
});

const Receipt = mongoose.model("Receipt", receiptSchema);
export default Receipt;
