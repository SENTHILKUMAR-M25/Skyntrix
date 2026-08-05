import mongoose from "mongoose";

// 16-stage project-lifecycle pipeline plus a terminal "closed" (lost/archive)
// state. `converted` is kept in the enum for backwards compatibility with the
// old lead-contact conversion flow.
export const LEAD_STAGES = [
  "new",
  "contacted",
  "meeting_scheduled",
  "requirement_collected",
  "quotation_sent",
  "follow_up",
  "approved",
  "advance_received",
  "agreement_signed",
  "project_started",
  "design_approval",
  "development",
  "testing",
  "final_payment",
  "delivered",
  "support",
];

export const LEAD_TERMINAL_STAGE = "closed";
export const LEAD_LEGACY_STAGE = "converted";

export const LEAD_STATUS = [...LEAD_STAGES, LEAD_TERMINAL_STAGE, LEAD_LEGACY_STAGE];

export const LEAD_PRIORITY = ["low", "medium", "high", "urgent"];

const reminderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
    dueAt: { type: Date, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System", trim: true },
  },
  { _id: true, timestamps: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    size: { type: Number, default: 0 },
    stage: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    uploadedByName: { type: String, default: "System", trim: true },
  },
  { _id: true, timestamps: true }
);

const stageLogEntrySchema = new mongoose.Schema(
  {
    stage: { type: String, enum: LEAD_STATUS, required: true },
    enteredAt: { type: Date, default: () => new Date() },
    leftAt: { type: Date, default: null },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    company: { type: String, default: "" },
    service: { type: String, default: "" },
    budget: { type: String, default: "" },
    message: { type: String, default: "" },
    source: { type: String, default: "" },

    // Pipeline stage / lifecycle
    status: { type: String, enum: LEAD_STATUS, default: "new" },
    stageEnteredAt: { type: Date, default: null },
    stageLog: { type: [stageLogEntrySchema], default: [] },

    // Opportunity management
    priority: { type: String, enum: LEAD_PRIORITY, default: "medium" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    assignedToName: { type: String, default: "", trim: true },
    dueDate: { type: Date, default: null },
    dealValue: { type: Number, default: 0, min: 0 },
    probability: { type: Number, default: 0, min: 0, max: 100 },
    tags: { type: [String], default: [] },
    closeReason: { type: String, trim: true, default: "" },

    notes: { type: String, default: "" },
    reminders: { type: [reminderSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },

    // Project payment summary (auto-synced from approved quotation + invoices).
    projectTotal: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, priority: 1, createdAt: -1 });
leadSchema.index({ status: 1, dueDate: 1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ name: "text", email: "text", company: "text", service: "text", tags: "text" });

const Lead = mongoose.model("Lead", leadSchema);
export default Lead;
