import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Skyntrix API is running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;