import { Router } from "express";
import authRoutes from "./auth.routes.js";
import serviceRoutes from "./service.routes.js";
import portfolioRoutes from "./portfolio.routes.js";
import teamRoutes from "./team.routes.js";
import testimonialRoutes from "./testimonial.routes.js";
import blogRoutes from "./blog.routes.js";
import careerRoutes from "./career.routes.js";
import leadRoutes from "./lead.routes.js";
import leadContactRoutes from "./leadContact.routes.js";
import newsletterRoutes from "./newsletter.routes.js";
import settingsRoutes from "./settings.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import quotationRoutes from "./quotation.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.get("/", (req, res) =>
  res.status(200).json({ success: true, message: "Skyntrix API", endpoints: "/api/v1/..." })
);
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/services", serviceRoutes);
router.use("/portfolio", portfolioRoutes);
router.use("/team", teamRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/blogs", blogRoutes);
router.use("/careers", careerRoutes);
router.use("/leads", leadRoutes);
router.use("/lead-contacts", leadContactRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/settings", settingsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/quotations", quotationRoutes);
router.use("/invoices", invoiceRoutes);

export default router;