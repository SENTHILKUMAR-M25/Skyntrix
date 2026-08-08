import mongoose from "mongoose";

// Statuses a requirement moves through before it is ready for quotation.
export const REQUIREMENT_STATUS = ["draft", "collected", "under_review", "ready_for_quotation"];

export const REQUIREMENT_PRIORITY = ["low", "medium", "high", "urgent"];

export const REQUIREMENT_PROJECT_TYPES = [
  "Website Development",
  "E-commerce Website",
  "Mobile App",
  "Web Application",
  "CRM",
  "Admin Panel",
  "UI/UX Design",
  "Digital Marketing",
  "SEO",
  "Other",
];

const requirementSchema = new mongoose.Schema(
  {
    // Ownership / relationships. A requirement always belongs to a contact
    // (LeadContact); the source inquiry lead is kept for reference.
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "LeadContact", required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },

    // Client information (snapshot from the contact, editable).
    businessName: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "", lowercase: true },
    location: { type: String, trim: true, default: "" },
    existingWebsite: { type: String, trim: true, default: "" },
    socialMediaLinks: { type: [String], default: [] },

    // Project requirement
    projectType: { type: String, enum: REQUIREMENT_PROJECT_TYPES, default: "" },
    projectName: { type: String, trim: true, default: "" },
    businessDescription: { type: String, trim: true, default: "" },
    projectDescription: { type: String, trim: true, default: "" },
    mainObjective: { type: String, trim: true, default: "" },
    targetAudience: { type: String, trim: true, default: "" },
    requiredFeatures: { type: String, trim: true, default: "" },
    numberOfPages: { type: Number, default: 0, min: 0 },
    numberOfProducts: { type: Number, default: 0, min: 0 },
    adminPanelRequired: { type: Boolean, default: false },
    paymentGatewayRequired: { type: Boolean, default: false },
    authenticationRequired: { type: Boolean, default: false },
    whatsappIntegration: { type: Boolean, default: false },
    emailIntegration: { type: Boolean, default: false },
    thirdPartyIntegrations: { type: String, trim: true, default: "" },
    hostingRequired: { type: Boolean, default: false },
    domainRequired: { type: Boolean, default: false },
    maintenanceRequired: { type: Boolean, default: false },

    // Technical requirements
    preferredTechnology: { type: String, trim: true, default: "" },
    frontend: { type: String, trim: true, default: "" },
    backend: { type: String, trim: true, default: "" },
    database: { type: String, trim: true, default: "" },
    apiRequirements: { type: String, trim: true, default: "" },
    hostingDeploymentRequirements: { type: String, trim: true, default: "" },
    otherTechnicalRequirements: { type: String, trim: true, default: "" },

    // Budget & timeline
    clientBudget: { type: Number, default: 0, min: 0 },
    expectedStartDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    priority: { type: String, enum: REQUIREMENT_PRIORITY, default: "medium" },
    estimatedDevelopmentCost: { type: Number, default: 0, min: 0 },
    estimatedMaintenanceCost: { type: Number, default: 0, min: 0 },

    // Additional information
    clientExpectations: { type: String, trim: true, default: "" },
    referenceWebsites: { type: String, trim: true, default: "" },
    competitorWebsites: { type: String, trim: true, default: "" },
    designPreferences: { type: String, trim: true, default: "" },
    specialInstructions: { type: String, trim: true, default: "" },
    internalNotes: { type: String, trim: true, default: "" },

    status: { type: String, enum: REQUIREMENT_STATUS, default: "draft", index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByName: { type: String, default: "System" },
  },
  { timestamps: true }
);

// A contact can hold several requirement revisions but should normally have a
// single active one. The most recently updated requirement wins when deriving
// the pipeline stage.
requirementSchema.index({ contactId: 1, updatedAt: -1 });
requirementSchema.index({ status: 1, updatedAt: -1 });
requirementSchema.index({ businessName: "text", projectName: "text", clientName: "text", email: "text", mobileNumber: "text" });

const Requirement = mongoose.model("Requirement", requirementSchema);
export default Requirement;
