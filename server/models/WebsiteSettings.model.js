import mongoose from "mongoose";

const websiteSettingsSchema = new mongoose.Schema(
  {
    company: {
      name: { type: String, default: "Skyntrix Technologies" },
      shortName: { type: String, default: "Skyntrix" },
      tagline: { type: String, default: "Building Digital Experiences That Drive Growth" },
      email: { type: String, default: "hello@skyntrix.com" },
      careersEmail: { type: String, default: "careers@skyntrix.com" },
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      address: { type: String, default: "" },
      hours: { type: String, default: "" },
    },
    logo: {
      main: { type: String, default: "" },
      mainPublicId: { type: String, default: "" },
      favicon: { type: String, default: "" },
      faviconPublicId: { type: String, default: "" },
      footer: { type: String, default: "" },
      footerPublicId: { type: String, default: "" },
    },
    social: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      github: { type: String, default: "" },
      dribbble: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      ogImage: { type: String, default: "" },
      ogImagePublicId: { type: String, default: "" },
      keywords: [{ type: String }],
    },
    analytics: {
      googleAnalytics: { type: String, default: "" },
      googleTagManager: { type: String, default: "" },
    },
    footer: {
      copyright: { type: String, default: "" },
      description: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Ensure only one settings document
websiteSettingsSchema.statics.getSingleton = async function () {
  const doc = await this.findOne();
  if (doc) return doc;
  return this.create({});
};

const WebsiteSettings = mongoose.model("WebsiteSetting", websiteSettingsSchema);
export default WebsiteSettings;