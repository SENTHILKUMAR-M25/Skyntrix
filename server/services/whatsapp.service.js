import { env } from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Unicode emoji + box-drawing constants.
 *
 * IMPORTANT: Every emoji is declared as a Unicode code-point escape (`\u{...}`)
 * instead of a literal emoji character. The source file therefore only contains
 * ASCII bytes, so it can never be corrupted by an editor, git client, or build
 * tool that reads/writes files with a non-UTF-8 encoding (e.g. Windows-1252 /
 * Latin-1). That single-byte round-trip is exactly what turns emojis into the
 * U+FFFD replacement character (`�`) that shows up inside WhatsApp.
 */
export const EMOJI = {
  wave: "\u{1F44B}",            // 👋
  building: "\u{1F3E2}",        // 🏢
  memo: "\u{1F4DD}",            // 📝
  demo: "\u{1F3A5}",            // 🎥
  globe: "\u{1F310}",           // 🌐
  plate: "\u{1F37D}\u{FE0F}",   // 🍽️
  car: "\u{1F697}",             // 🚗
  chart: "\u{1F4CA}",           // 📊
  phone: "\u{1F4F1}",           // 📱
  briefcase: "\u{1F4BC}",       // 💼
  sparkle: "\u{2728}",          // ✨
  heavyMinus: "\u{2501}",       // ━
};

/** ━━━━━━━━━━━━━━━━━━ (18 heavy horizontal lines) */
const RULE = EMOJI.heavyMinus.repeat(18);

/**
 * Lead Contact WhatsApp message template.
 * `{businessName}`, `{summary}`, `{demoLink}`, `{websiteLink}` get substituted.
 * Built from ASCII-only sources (see EMOJI) so the emojis can't be corrupted.
 */
export const WHATSAPP_MESSAGE_TEMPLATE = `${EMOJI.wave} Hello!

Thank you for your interest in Skyntrix.

${RULE}

${EMOJI.building} Business Name
{businessName}

${EMOJI.memo} About Your Project
{summary}

${EMOJI.demo} Live Demo
{demoLink}

${EMOJI.globe} Our Website
{websiteLink}

${RULE}

At Skyntrix, we build modern, scalable, and business-focused digital solutions, including:

${EMOJI.globe} Business & Corporate Websites
${EMOJI.plate} Restaurant & Hotel Websites
${EMOJI.car} Parking Management Systems
${EMOJI.chart} CRM & ERP Software
${EMOJI.phone} Mobile Applications
${EMOJI.briefcase} Custom Web Applications

${EMOJI.sparkle} We'd be happy to provide a FREE consultation and a personalized live demo based on your business requirements.

Simply reply to this message, and our team will get in touch with you.

${RULE}

Best Regards,

Skyntrix Team
Building Smart Digital Solutions

${EMOJI.globe} {websiteLink}
`;

const SERVICES = [
  "Business & Corporate Websites",
  "Restaurant & Hotel Websites",
  "Parking Management Systems",
  "CRM & ERP Software",
  "Mobile Applications",
  "Custom Web Applications",
];

const REPLACEMENT_CHAR = "\uFFFD";

/**
 * Self-heal a template that was corrupted by a non-UTF-8 read/write.
 *
 * If the template file is ever re-saved with a legacy encoding, every literal
 * emoji and separator character becomes U+FFFD (`�`). Because the message
 * layout is deterministic, each `�` is matched by its surrounding text and
 * restored to the correct emoji. Messages without corruption pass through
 * unchanged.
 */
export const repairCorruptedEmojis = (message) => {
  if (!message || !message.includes(REPLACEMENT_CHAR)) return message;

  let repaired = message;
  const repairs = [
    [/\uFFFD+\s*Hello!/, `${EMOJI.wave} Hello!`],
    [/\uFFFD+\s*Business Name/, `${EMOJI.building} Business Name`],
    [/\uFFFD+\s*About Your Project/, `${EMOJI.memo} About Your Project`],
    [/\uFFFD+\s*Live Demo/, `${EMOJI.demo} Live Demo`],
    [/\uFFFD+\s*Our Website/, `${EMOJI.globe} Our Website`],
    [/\uFFFD+\s*Business & Corporate Websites/, `${EMOJI.globe} Business & Corporate Websites`],
    [/\uFFFD+\s*Restaurant & Hotel Websites/, `${EMOJI.plate} Restaurant & Hotel Websites`],
    [/\uFFFD+\s*Parking Management Systems/, `${EMOJI.car} Parking Management Systems`],
    [/\uFFFD+\s*CRM & ERP Software/, `${EMOJI.chart} CRM & ERP Software`],
    [/\uFFFD+\s*Mobile Applications/, `${EMOJI.phone} Mobile Applications`],
    [/\uFFFD+\s*Custom Web Applications/, `${EMOJI.briefcase} Custom Web Applications`],
    [/\uFFFD+\s*We'd be happy/, `${EMOJI.sparkle} We'd be happy`],
    [/\uFFFD+\s*\{websiteLink\}/, `${EMOJI.globe} {websiteLink}`],
  ];
  for (const [pattern, fixed] of repairs) {
    repaired = repaired.replace(pattern, fixed);
  }

  // Separator lines reduced to replacement characters → rebuild the rule.
  repaired = repaired.replace(/^[\uFFFD]+$/gm, RULE);

  return repaired;
};

const TEMPLATE_PLACEHOLDERS = ["{businessName}", "{summary}", "{demoLink}", "{websiteLink}"];

/**
 * Build the exact formatted WhatsApp message for a lead contact.
 * Optional fields fall back to a placeholder so the message stays well-formed.
 * `split/join` substitutes every occurrence (a token can appear more than once)
 * without interpreting `$` sequences the way `String.replace` does.
 */
export const buildWhatsAppMessage = (
  { businessName, summary, demoLink, websiteLink },
  { website = env.whatsapp.website } = {}
) => {
  const fill = (value, fallback) => (value && String(value).trim() ? String(value).trim() : fallback);
  const values = [
    fill(businessName, "\u2014"),
    fill(summary, "\u2014"),
    fill(demoLink, "\u2014"),
    fill(websiteLink, website),
  ];
  return TEMPLATE_PLACEHOLDERS.reduce(
    (template, token, i) => template.split(token).join(values[i]),
    repairCorruptedEmojis(WHATSAPP_MESSAGE_TEMPLATE)
  );
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
