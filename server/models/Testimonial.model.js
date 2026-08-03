import mongoose from "mongoose";

export const TESTIMONIAL_STATUS = ["draft", "published", "archived"];

const testimonialSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    company: { type: String, default: "" },
    designation: { type: String, default: "" },
    review: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    status: { type: String, enum: TESTIMONIAL_STATUS, default: "published" },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

testimonialSchema.index({ status: 1, featured: 1, displayOrder: 1 });

const Testimonial = mongoose.model("Testimonial", testimonialSchema);
export default Testimonial;