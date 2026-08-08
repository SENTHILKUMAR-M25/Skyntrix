import mongoose from "mongoose";

export const LEAD_CONTACT_STATUS = ["draft", "sent", "failed"];
export const WHATSAPP_SEND_STATUS = ["pending", "sent", "failed"];
export const FOLLOW_UP_STATUS = ["none", "follow-up", "converted", "closed"];

// Sales pipeline stages for the contact-centric flow:
// Lead -> Contact -> Requirement Collected -> Ready for Quotation ->
// Quotation Created -> Quotation Accepted -> Invoice Created -> Payment -> Completed
export const CONTACT_PIPELINE_STAGES = [
  "lead",
  "contact",
  "requirement_collected",
  "ready_for_quotation",
  "quotation_created",
  "quotation_accepted",
  "invoice_created",
  "payment",
  "completed",
];

export const CONTACT_CHANNELS = ["call", "whatsapp", "email", "other"];

const leadContactSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 200 },
    mobileNumber: { type: String, required: true, trim: true, maxlength: 20 },
    summary: { type: String, required: true, trim: true, maxlength: 2000 },
    demoLink: { type: String, trim: true, default: "", maxlength: 500 },
    websiteLink: { type: String, trim: true, default: "", maxlength: 500 },

    // Lead stage: basic enquiry details.
    contactPerson: { type: String, trim: true, default: "", maxlength: 200 },
    email: { type: String, trim: true, default: "", lowercase: true, maxlength: 200 },
    location: { type: String, trim: true, default: "", maxlength: 200 },
    source: { type: String, trim: true, default: "", maxlength: 200 },

    // Contact stage: how/when the Skyntrix team first got in touch.
    contactedAt: { type: Date, default: null },
    contactDate: { type: Date, default: null },
    contactChannel: { type: String, enum: [...CONTACT_CHANNELS, ""], default: "" },
    contactNotes: { type: String, trim: true, default: "", maxlength: 3000 },
    lastContactAt: { type: Date, default: null },

    // Sales pipeline stage (auto-derived from requirement/quotation/invoice/payment state).
    pipelineStage: { type: String, enum: CONTACT_PIPELINE_STAGES, default: "lead", index: true },

    status: { type: String, enum: LEAD_CONTACT_STATUS, default: "draft", index: true },
    whatsappStatus: { type: String, enum: WHATSAPP_SEND_STATUS, default: "pending", index: true },
    notes: { type: String, trim: true, default: "", maxlength: 3000 },
    tags: { type: [String], default: [], index: true },
    followUpStatus: { type: String, enum: FOLLOW_UP_STATUS, default: "none", index: true },
    nextFollowUpAt: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    assignedToName: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System" },
    sourceLead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    sourceLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

leadContactSchema.index({ status: 1, createdAt: -1 });
leadContactSchema.index({ whatsappStatus: 1, createdAt: -1 });
leadContactSchema.index({ pipelineStage: 1, createdAt: -1 });
leadContactSchema.index({ businessName: "text", mobileNumber: "text", summary: "text", tags: "text", contactPerson: "text", email: "text" });

const LeadContact = mongoose.model("LeadContact", leadContactSchema);
export default LeadContact;
