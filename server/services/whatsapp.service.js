import { env } from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Lead Contact WhatsApp message template.
 * `{businessName}`, `{summary}`, `{demoLink}`, `{websiteLink}` get substituted.
 */
export const WHATSAPP_MESSAGE_TEMPLATE = `👋 Hello!
Thank you for your interest in Skyntrix.
━━━━━━━━━━━━━━━━━━
🏢 Business Name
{businessName}
📝 Summary
{summary}
🌐 Demo
{demoLink}
💻 Website
{websiteLink}
━━━━━━━━━━━━━━━━━━
We specialize in:
✅ Business Websites
✅ Restaurant Websites
✅ Hotel Websites
✅ Parking Management Systems
✅ CRM Software
✅ ERP Solutions
✅ Mobile Applications
✅ Custom Web Applications
If you'd like a free consultation or live demo, simply reply to this message.
Thank you!
Regards,
Skyntrix Team`;

const SERVICES = [
  "Business Websites",
  "Restaurant Websites",
  "Hotel Websites",
  "Parking Management Systems",
  "CRM Software",
  "ERP Solutions",
  "Mobile Applications",
  "Custom Web Applications",
];

/**
 * Build the exact formatted WhatsApp message for a lead contact.
 * Optional fields fall back to a placeholder so the message stays well-formed.
 */
export const buildWhatsAppMessage = (
  { businessName, summary, demoLink, websiteLink },
  { website = env.whatsapp.website } = {}
) => {
  const fill = (value, fallback) => (value && String(value).trim() ? String(value).trim() : fallback);
  return WHATSAPP_MESSAGE_TEMPLATE
    .replace("{businessName}", fill(businessName, "—"))
    .replace("{summary}", fill(summary, "—"))
    .replace("{demoLink}", fill(demoLink, "—"))
    .replace("{websiteLink}", fill(websiteLink, website));
};

/**
 * Normalize an international mobile number to E.164 format (91XXXXXXXXXX).
 * Accepts +91XXXXXXXXXX / 91XXXXXXXXXX / 0XXXXXXXXXX / 10-digit Indian numbers.
 * Returns null when the number is invalid.
 */
export const normalizeMobileNumber = (input) => {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return null;
};

/** True when WhatsApp Cloud API credentials are configured. */
export const isWhatsAppConfigured = () =>
  Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);

/** Build a https://wa.me/ deep link for the fallback path. */
export const buildWaMeUrl = (mobileNumber, message) =>
  `https://wa.me/${normalizeMobileNumber(mobileNumber)}?text=${encodeURIComponent(message)}`;

/**
 * Send a WhatsApp message through the WhatsApp Business Cloud API.
 *
 * When Cloud API credentials are NOT configured this returns a fallback payload
 * containing a wa.me deep link so the caller can open WhatsApp Web instead.
 *
 * @param {{ to: string, body: string }} args
 * @returns {Promise<{ status: "success"|"fallback"|"failed", providerMessageId?: string, waUrl?: string, error?: string }>}
 */
export const sendWhatsAppMessage = async ({ to, body }) => {
  const digits = normalizeMobileNumber(to);
  if (!digits) {
    logger.warn(`[WhatsApp] invalid mobile number: ${to}`);
    return { status: "failed", error: "Invalid mobile number" };
  }

  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, body);
    logger.info(`[WhatsApp] Cloud API not configured - fallback link generated for ${digits}`);
    return { status: "fallback", waUrl, error: "" };
  }

  const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: { preview_url: true, body },
      }),
    });

    const payload = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const fbError = payload?.error?.message || `WhatsApp API error (${resp.status})`;
      logger.error(`[WhatsApp] send failed: ${fbError}`);
      return { status: "failed", error: fbError };
    }

    const messageId = payload?.messages?.[0]?.id || "";
    logger.info(`[WhatsApp] message sent to ${digits} (id: ${messageId})`);
    return { status: "success", providerMessageId: messageId, error: "" };
  } catch (err) {
    logger.error(`[WhatsApp] network error: ${err.message}`);
    return { status: "failed", error: err.message || "Network error while contacting WhatsApp API" };
  }
};

/** Human-readable list of Skyntrix services used in templates. */
export const SKYNTRIX_SERVICES = SERVICES;
