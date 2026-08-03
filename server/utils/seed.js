import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Admin, { rolePermissions, ROLES } from "../models/Admin.model.js";
import Service from "../models/Service.model.js";
import Portfolio from "../models/Portfolio.model.js";
import Team from "../models/Team.model.js";
import Testimonial from "../models/Testimonial.model.js";
import Blog from "../models/Blog.model.js";
import WebsiteSettings from "../models/WebsiteSettings.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const seed = [
  {
    name: "Services",
    run: async () => {
      if (await Service.countDocuments()) return console.log("Services: skip (exists)");
      await Service.insertMany([
        {
          title: "Website Development",
          slug: "website-development",
          short: "High-performance websites that load fast and convert.",
          icon: "globe",
          overview: "Conversion-focused websites built on modern stacks.",
          features: ["Custom design", "E-commerce", "SEO-ready"],
          technologies: ["React", "Next.js", "Node.js", "Tailwind CSS"],
          benefits: ["Fast", "Secure"],
          status: "published",
          featured: true,
          displayOrder: 1,
        },
        {
          title: "Mobile App Development",
          slug: "mobile-app-development",
          short: "Native & cross-platform apps users love.",
          icon: "phone",
          overview: "Apps built for iOS, Android and the web.",
          features: ["iOS & Android", "Backend APIs", "Push notifications"],
          technologies: ["React Native", "Flutter", "Node.js"],
          benefits: ["Faster time to market"],
          status: "published",
          displayOrder: 2,
        },
        {
          title: "UI/UX Design",
          slug: "ui-ux-design",
          short: "Human-centered design that converts.",
          icon: "palette",
          overview: "Wireframes, prototypes and design systems.",
          features: ["Research", "Prototyping", "Design systems"],
          technologies: ["Figma", "Framer"],
          benefits: ["Higher engagement"],
          status: "published",
          displayOrder: 3,
        },
        {
          title: "Social Media Marketing",
          slug: "social-media-marketing",
          short: "Strategy, content and paid campaigns.",
          icon: "share",
          overview: "Grow your brand across social channels.",
          features: ["Strategy", "Content", "Paid campaigns"],
          technologies: ["Meta Ads", "Google Ads"],
          benefits: ["Measurable ROI"],
          status: "published",
          displayOrder: 4,
        },
        {
          title: "Branding",
          slug: "branding",
          short: "Logo to complete brand identity.",
          icon: "brush",
          overview: "Cohesive brands built to scale.",
          features: ["Logo design", "Guidelines"],
          technologies: ["Illustrator", "Figma"],
          benefits: ["Stronger trust"],
          status: "published",
          displayOrder: 5,
        },
        {
          title: "SEO Optimization",
          slug: "seo",
          short: "Rank higher in Google.",
          icon: "search",
          overview: "Technical & content SEO that grows organic traffic.",
          features: ["Technical audits", "Keyword strategy"],
          technologies: ["Search Console", "Ahrefs"],
          benefits: ["Higher rankings"],
          status: "published",
          displayOrder: 6,
        },
      ]);
      console.log("Services seeded");
    },
  },
  {
    name: "Portfolio",
    run: async () => {
      if (await Portfolio.countDocuments()) return;
      await Portfolio.insertMany([
        {
          title: "MediPulse - Healthcare App",
          slug: "medipulse-app",
          client: "MediPulse Health",
          category: "Mobile App",
          industry: "Healthcare",
          overview: "A patient-first healthcare app.",
          featured: true,
          displayOrder: 1,
          status: "published",
        },
        {
          title: "Zeva Fashion Store",
          slug: "zeva-fashion",
          client: "Zeva Fashion",
          category: "E-Commerce",
          industry: "E-commerce",
          overview: "A high-converting fashion storefront.",
          featured: true,
          displayOrder: 2,
          status: "published",
        },
        {
          title: "Growthly SaaS Dashboard",
          slug: "growthly-saas",
          client: "Growthly Inc.",
          category: "Web App",
          industry: "Startup / SaaS",
          overview: "Real-time analytics dashboard.",
          featured: true,
          displayOrder: 3,
          status: "published",
        },
      ]);
      console.log("Portfolio seeded");
    },
  },
  {
    name: "Team",
    run: async () => {
      if (await Team.countDocuments()) return;
      await Team.insertMany([
        { name: "Senthil", position: "Founder & Full Stack Developer", bio: "Building products that drive growth.", skills: ["Node.js", "Architecture"], displayOrder: 1 },
        { name: "Meera Nair", position: "Frontend Developer", bio: "Obsessed with clean, performant interfaces.", skills: ["React", "TypeScript"], displayOrder: 2 },
        { name: "Vikram Singh", position: "Backend Developer", bio: "Scalable, secure APIs and infra.", skills: ["Node.js", "MongoDB", "AWS"], displayOrder: 3 },
        { name: "Ishita Patel", position: "UI/UX & Graphic Designer", bio: "Designing interfaces people love.", skills: ["Figma", "Branding"], displayOrder: 4 },
      ]);
      console.log("Team seeded (4 members)");
    },
  },
  {
    name: "Testimonials",
    run: async () => {
      if (await Testimonial.countDocuments()) return;
      await Testimonial.insertMany([
        { clientName: "Priya Menon", company: "Zeva Fashion", review: "Our sales nearly doubled after the rebuild.", rating: 5, status: "published" },
        { clientName: "Dr. Ananya Rao", company: "MediPulse", review: "A patient experience our team loves.", rating: 5, status: "published" },
        { clientName: "Rahul Sharma", company: "Growthly", review: "World-class engineering and design.", rating: 5, status: "published" },
      ]);
      console.log("Testimonials seeded");
    },
  },
  {
    name: "Blog",
    run: async () => {
      if (await Blog.countDocuments()) return;
      await Blog.insertMany([
        {
          title: "Why Page Speed Is Your Secret SEO Weapon",
          slug: "why-speed-matters-for-seo",
          category: "SEO",
          excerpt: "Speed is a core ranking factor.",
          content: "<p>Fast sites rank higher and convert better.</p>",
          author: "Skyntrix Team",
          tags: ["SEO"],
          status: "published",
          publishedDate: new Date(),
        },
      ]);
      console.log("Blog seeded");
    },
  },
];

const main = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skyntrix";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Ensure website settings singleton
  await WebsiteSettings.getSingleton();

  for (const item of seed) {
    if (typeof item.run === "function") await item.run();
  }

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@skyntrix.com";
  const existing = await Admin.findOne({ email: adminEmail });
  if (!existing) {
    await Admin.create({
      name: process.env.SEED_ADMIN_NAME || "Administrator",
      email: adminEmail,
      password: process.env.SEED_ADMIN_PASSWORD || "Admin@12345",
      role: process.env.SEED_ADMIN_ROLE || ROLES.SUPER_ADMIN,
      permissions: rolePermissions(ROLES.SUPER_ADMIN),
    });
    console.log(`Admin created: ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD || "Admin@12345"}`);
  } else {
    console.log("Admin already exists");
  }

  await mongoose.disconnect();
  console.log("Seeding complete.");
};

main().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(1);
});