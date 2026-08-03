import mongoose from "mongoose";

export const LEAD_STATUS = ["new", "contacted", "converted", "closed"];

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
    status: { type: String, enum: LEAD_STATUS, default: "new" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ name: "text", email: "text", company: "text", service: "text" });

const Lead = mongoose.model("Lead", leadSchema);
export default Lead;