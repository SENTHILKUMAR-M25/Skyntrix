import fs from "fs";
import { env } from "../config/env.js";
import WhatsAppConversation from "../models/WhatsAppConversation.model.js";
import logger from "../utils/logger.js";

/**
 * Meta error code raised when a free-form message is attempted outside the
 * 24-hour customer service window (no active conversation with the client).
 */
export const SESSION_ENDED_ERROR = 131026;

/** Meta's WhatsApp Cloud API media size limit (16 MB for documents/media). */
export const META_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/** The only MIME type accepted for quotation PDF attachments. */
export const PDF_MIME_TYPE = "application/pdf";

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

// ---------------------------------------------------------------------------
// 24-hour customer service session tracking
// ---------------------------------------------------------------------------

/**
 * True when the client has an OPEN 24-hour customer service window with us,
 * i.e. their last inbound message arrived less than 24 hours ago. This is fed
 * by the WhatsApp webhook (customer messages are recorded on arrival), so it is
 * only reliable once the webhook is configured and receiving events.
 */
export const isActiveConversation = async (phone) => {
  const digits = normalizeMobileNumber(phone);
  if (!digits) return false;
  const convo = await WhatsAppConversation.findOne({ phoneNumber: digits }).lean();
  if (!convo?.lastInboundAt) return false;
  return Date.now() - new Date(convo.lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
};

/** Record a customer's inbound message (opens / extends the 24h window). */
export const markConversationInbound = async (phone, messageId = "") => {
  const digits = normalizeMobileNumber(phone);
  if (!digits) return;
  await WhatsAppConversation.findOneAndUpdate(
    { phoneNumber: digits },
    { $set: { lastInboundAt: new Date() }, $inc: { inboundCount: 1 } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  logger.info(`[WhatsApp] inbound message recorded for ${digits}`);
};

/** Record an outbound message (used after a template / follow-up send). */
export const markConversationOutbound = async (phone, messageId = "") => {
  const digits = normalizeMobileNumber(phone);
  if (!digits) return;
  await WhatsAppConversation.findOneAndUpdate(
    { phoneNumber: digits },
    {
      $set: { lastOutboundAt: new Date(), ...(messageId ? { lastTemplateMessageId: messageId } : {}) },
      $inc: { outboundCount: 1 },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

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
    return { status: "failed", error: "Invalid mobile number", errorCode: 0 };
  }

  if (!isWhatsAppConfigured()) {
    const waUrl = buildWaMeUrl(digits, body);
    logger.info(`[WhatsApp] Cloud API not configured - fallback link generated for ${digits}`);
    return { status: "fallback", waUrl, error: "", errorCode: 0 };
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
      return { status: "failed", error: fbError, errorCode: payload?.error?.code || 0 };
    }

    const messageId = payload?.messages?.[0]?.id || "";
    logger.info(`[WhatsApp] message sent to ${digits} (id: ${messageId})`);
    return { status: "success", providerMessageId: messageId, error: "", errorCode: 0 };
  } catch (err) {
    logger.error(`[WhatsApp] network error: ${err.message}`);
    return { status: "failed", error: err.message || "Network error while contacting WhatsApp API", errorCode: 0 };
  }
};

/**
 * True when a URL is HTTPS and not a loopback / local machine address.
 * The WhatsApp Cloud API only downloads document/media links that are publicly
 * reachable, so localhost URLs cannot be used to attach files.
 */
export const isPubliclyReachableUrl = (url = "") => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Meta Graph API helpers
// ---------------------------------------------------------------------------

/** Build a Graph API URL for the configured phone number. */
const graphApiUrl = (suffix) =>
  `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}${suffix}`;

/** Human-readable byte size (e.g. "1.4 MB"). */
const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

/** Extract the structured Meta error fields from an API response payload. */
const extractMetaError = (payload = {}) => {
  const error = payload?.error || {};
  return {
    code: error?.code ?? 0,
    subcode: error?.error_subcode ?? 0,
    message: String(error?.message || ""),
    details: String(error?.error_data?.details || ""),
    traceId: String(error?.fbtrace_id || ""),
  };
};

/** Build a single, human-readable error string from a Meta error payload. */
const buildMetaError = (context, status, payload) => {
  const { code, subcode, message, details, traceId } = extractMetaError(payload);
  const parts = [`${context} failed (HTTP ${status})`];
  if (code) parts.push(`Meta error ${code}`);
  if (subcode) parts.push(`subcode ${subcode}`);
  if (message) parts.push(message);
  if (details) parts.push(details);
  if (traceId) parts.push(`trace ${traceId}`);
  return parts.join(" - ");
};

/**
 * Upload a local media file (PDF, etc.) to the WhatsApp Cloud API
 * (POST /{PHONE_NUMBER_ID}/media) and return the media ID that can be
 * referenced in a document message. This is the recommended approach because it
 * requires NO publicly reachable URL - the file is uploaded to Meta's servers
 * (kept for 30 days) and referenced by `id`.
 *
 * Validates that the file exists, is not empty, the MIME type is
 * application/pdf and the size is within Meta's 16 MB limit. Logs the full
 * request and response, including Meta error codes and messages, on every call.
 *
 * @param {{ filePath: string, mimeType?: string, filename?: string }} args
 * @returns {Promise<string>} media id
 */
export const uploadWhatsAppMedia = async ({ filePath, mimeType = PDF_MIME_TYPE, filename = "document.pdf" }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath || "(no path provided)"}`);
  }

  const resolvedMime = mimeType || PDF_MIME_TYPE;
  if (resolvedMime !== PDF_MIME_TYPE) {
    throw new Error(`Invalid media MIME type "${resolvedMime}" - expected "${PDF_MIME_TYPE}"`);
  }

  const { size } = fs.statSync(filePath);
  if (size === 0) {
    throw new Error("PDF file is empty (0 bytes) - cannot upload");
  }
  if (size > META_MEDIA_MAX_BYTES) {
    throw new Error(`PDF is ${formatBytes(size)} which exceeds Meta's ${formatBytes(META_MEDIA_MAX_BYTES)} upload limit`);
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([fileBuffer], { type: resolvedMime }), filename);

  const url = graphApiUrl("/media");
  logger.info({ msg: "[WhatsApp] Media Upload request", url, filename, mimeType: resolvedMime, bytes: size });

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` },
      body: form,
    });
  } catch (err) {
    logger.error({ msg: "[WhatsApp] Media Upload network error", error: err.message });
    throw new Error(`Media upload network error: ${err.message}`);
  }

  const payload = await resp.json().catch(() => ({}));
  logger.info({ msg: "[WhatsApp] Media Upload response", status: resp.status, response: payload });

  if (!resp.ok) {
    const error = buildMetaError("Media upload", resp.status, payload);
    logger.error({ msg: "[WhatsApp] Media Upload failed", status: resp.status, error });
    throw new Error(error);
  }

  const mediaId = payload?.id || "";
  if (!mediaId) {
    logger.error({ msg: "[WhatsApp] Media Upload returned no media id", response: payload });
    throw new Error("WhatsApp media upload returned no media id");
  }

  logger.info({ msg: "[WhatsApp] media uploaded", mediaId, filename });
  return mediaId;
};

/**
 * Send a document (PDF, etc.) through the WhatsApp Business Cloud API
 * (POST /{PHONE_NUMBER_ID}/messages with "type": "document").
 *
 * When `filePath` is provided the PDF is first uploaded to Meta via the Media
 * Upload API to obtain a media id, then sent by `id` (recommended - no public
 * URL needed). Otherwise the document `link` is used, which must be HTTPS and
 * publicly reachable by Meta (never localhost/private).
 *
 * Logs the complete request and response - including Meta error codes and
 * messages - and returns `failed` with the exact error so the caller can never
 * silently mark a quotation as sent.
 *
 * @param {{ to: string, link?: string, filePath?: string, caption?: string, filename?: string }} args
 * @returns {Promise<{ status: "success"|"fallback"|"failed", providerMessageId?: string, error?: string, errorCode?: number }>}
 */
export const sendWhatsAppDocument = async ({ to, link, filePath, caption = "", filename = "document.pdf" }) => {
  const digits = normalizeMobileNumber(to);
  if (!digits) {
    logger.warn(`[WhatsApp] invalid mobile number for document: ${to}`);
    return { status: "failed", error: "Invalid mobile number", errorCode: 0 };
  }

  if (!isWhatsAppConfigured()) {
    logger.info(`[WhatsApp] Cloud API not configured - document not sent for ${digits}`);
    return { status: "fallback", error: "", errorCode: 0 };
  }

  // Prefer the Media Upload API (upload local PDF -> media id). The link-based
  // method is only a fallback and requires a publicly reachable HTTPS URL.
  let documentPayload = null;

  if (filePath && fs.existsSync(filePath)) {
    try {
      const mediaId = await uploadWhatsAppMedia({ filePath, filename });
      documentPayload = { id: mediaId };
    } catch (err) {
      if (link && isPubliclyReachableUrl(link)) {
        logger.warn(`[WhatsApp] media upload failed for ${digits} - falling back to public link. Cause: ${err.message}`);
        documentPayload = { link };
      } else {
        logger.error(`[WhatsApp] media upload failed for ${digits} (no public link fallback available): ${err.message}`);
        return { status: "failed", error: err.message || "Media upload failed", errorCode: 0 };
      }
    }
  } else if (link) {
    if (!isPubliclyReachableUrl(link)) {
      logger.warn(`[WhatsApp] document link is not publicly reachable - cannot attach: ${link}`);
      return { status: "failed", error: "PDF link is not publicly reachable - use a public HTTPS URL (never localhost)", errorCode: 0 };
    }
    logger.info(`[WhatsApp] using public document link for ${digits}: ${link}`);
    documentPayload = { link };
  } else {
    return { status: "failed", error: "No document source provided (missing PDF file and no link)", errorCode: 0 };
  }

  const url = graphApiUrl("/messages");
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: digits,
    type: "document",
    document: {
      ...documentPayload,
      caption,
      filename,
    },
  };

  logger.info({
    msg: "[WhatsApp] Document Message request",
    url,
    to: digits,
    type: "document",
    source: documentPayload.id ? "media-id" : "link",
    filename,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await resp.json().catch(() => ({}));
    logger.info({ msg: "[WhatsApp] Document Message response", status: resp.status, response: payload });

    if (!resp.ok) {
      const error = buildMetaError("Document message", resp.status, payload);
      logger.error({ msg: "[WhatsApp] Document send failed", status: resp.status, error });
      return { status: "failed", error, errorCode: payload?.error?.code || 0 };
    }

    const messageId = payload?.messages?.[0]?.id || "";
    logger.info({ msg: "[WhatsApp] document sent", to: digits, messageId });
    return { status: "success", providerMessageId: messageId, error: "", errorCode: 0 };
  } catch (err) {
    logger.error({ msg: "[WhatsApp] document network error", error: err.message });
    return { status: "failed", error: err.message || "Network error while contacting WhatsApp API", errorCode: 0 };
  }
};

/**
 * Send a pre-approved WhatsApp message template (HSM/utility) to initiate a
 * conversation when the 24-hour customer service window is closed. `bodyParams`
 * maps 1:1 to the {{1}}, {{2}}, ... placeholders in the template body.
 *
 * @param {{ to: string, templateName: string, language?: string, bodyParams?: string[] }} args
 * @returns {Promise<{ status: "success"|"fallback"|"failed", providerMessageId?: string, error?: string, errorCode?: number }>}
 */
export const sendWhatsAppTemplate = async ({ to, templateName, language = "en", bodyParams = [] }) => {
  const digits = normalizeMobileNumber(to);
  if (!digits) {
    logger.warn(`[WhatsApp] invalid mobile number for template: ${to}`);
    return { status: "failed", error: "Invalid mobile number", errorCode: 0 };
  }

  if (!isWhatsAppConfigured()) {
    logger.info(`[WhatsApp] Cloud API not configured - template not sent for ${digits}`);
    return { status: "fallback", error: "", errorCode: 0 };
  }

  const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: digits,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((p) => ({ type: "text", text: String(p) })) }]
        : [],
    },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const fbError = payload?.error?.message || `WhatsApp template API error (${resp.status})`;
      logger.error(`[WhatsApp] template send failed: ${fbError}`);
      return { status: "failed", error: fbError, errorCode: payload?.error?.code || 0 };
    }

    const messageId = payload?.messages?.[0]?.id || "";
    logger.info(`[WhatsApp] template '${templateName}' sent to ${digits} (id: ${messageId})`);
    return { status: "success", providerMessageId: messageId, error: "", errorCode: 0 };
  } catch (err) {
    logger.error(`[WhatsApp] template network error: ${err.message}`);
    return { status: "failed", error: err.message || "Network error while contacting WhatsApp API", errorCode: 0 };
  }
};

/** Human-readable list of Skyntrix services used in templates. */
export const SKYNTRIX_SERVICES = SERVICES;
