import { Router } from "express";
import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyWebhook, receiveWebhook } from "../controllers/whatsappWebhook.controller.js";

/**
 * WhatsApp Cloud API webhook. Mounted at {apiPrefix}/whatsapp/webhook and must
 * be reached by Meta at a PUBLIC HTTPS URL - in development use a tunnel
 * (ngrok / Cloudflare Tunnel) and set WHATSAPP_WEBHOOK_VERIFY_TOKEN.
 *
 * GET  - verification challenge (hub.mode / hub.verify_token / hub.challenge)
 * POST - status + inbound events; body is consumed raw so the
 *        x-hub-signature-256 (when WHATSAPP_WEBHOOK_APP_SECRET is set) can be
 *        verified before the JSON is parsed.
 */
const router = Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", express.raw({ type: "*/*", limit: "2mb" }), asyncHandler(receiveWebhook));

export default router;
