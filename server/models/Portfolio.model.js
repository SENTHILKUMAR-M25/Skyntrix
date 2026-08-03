import mongoose from "mongoose";

export const PROJECT_STATUS = ["draft", "published", "archived"];

const portfolioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    client: { type: String, default: "" },
    industry: { type: String, default: "" },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    overview: { type: String, default: "" },
    problem: { type: String, default: "" },
    solution: { type: String, default: "" },
    results: { type: String, default: "" },
    technologies: [{ type: String }],
    images: [{ type: String }],
    imagePublicIds: [{ type: String }],
    thumbnail: { type: String, default: "" },
    thumbnailPublicId: { type: String, default: "" },
    liveDemo: { type: String, default: "" },
    github: { type: String, default: "" },
    completionDate: { type: Date },
    duration: { type: String, default: "" },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: PROJECT_STATUS, default: "published" },
    testimonial: {
      quote: { type: String, default: "" },
      author: { type: String, default: "" },
      role: { type: String, default: "" },
    },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: [{ type: String }],
    },
  },
  { timestamps: true }
);

portfolioSchema.index({ title: "text", overview: "text", description: "text", industry: 1, category: 1 });
portfolioSchema.index({ status: 1, featured: 1, displayOrder: 1 });

const Portfolio = mongoose.model("Portfolio", portfolioSchema);
export default Portfolio;