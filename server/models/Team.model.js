import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, default: "" },
    bio: { type: String, default: "" },
    skills: [{ type: String }],
    photo: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    social: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      github: { type: String, default: "" },
      dribbble: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ displayOrder: 1, isActive: 1 });
teamSchema.index({ name: "text", position: "text", bio: "text" });

const Team = mongoose.model("Team", teamSchema);
export default Team;