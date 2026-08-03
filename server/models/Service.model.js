import mongoose from "mongoose";

export const SERVICE_STATUS = ["draft", "published", "archived"];

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    short: { type: String, default: "" },
    icon: { type: String, default: "globe" },
    priceFrom: { type: String, default: "" },
    overview: { type: String, default: "" },
    heroImage: { type: String, default: "" },
    heroImagePublicId: { type: String, default: "" },
    features: [{ type: String }],
    technologies: [{ type: String }],
    benefits: [{ type: String }],
    workflow: [
      { step: { type: String }, title: { type: String }, desc: { type: String } },
    ],
    faqs: [{ q: { type: String }, a: { type: String } }],
    status: { type: String, enum: SERVICE_STATUS, default: "published" },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: [{ type: String }],
      openGraphImage: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

serviceSchema.index({ title: "text", short: "text", overview: "text" });
serviceSchema.index({ status: 1, displayOrder: 1 });

const Service = mongoose.model("Service", serviceSchema);
export default Service;