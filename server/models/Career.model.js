import mongoose from "mongoose";

export const APPLICATION_STATUS = ["new", "reviewed", "interviewed", "rejected", "hired", "archived"];

const careerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    position: { type: String, default: "" },
    experience: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    message: { type: String, default: "" },
    resume: { type: String, default: "" },
    resumePublicId: { type: String, default: "" },
    status: { type: String, enum: APPLICATION_STATUS, default: "new" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

careerSchema.index({ status: 1, position: 1, createdAt: -1 });
careerSchema.index({ name: "text", email: "text", position: "text" });

const Career = mongoose.model("CareerApplication", careerSchema);
export default Career;