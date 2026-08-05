import crypto from "crypto";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { env } from "../config/env.js";
import Quotation from "../models/Quotation.model.js";
import QuotationSendLog from "../models/QuotationSendLog.model.js";
import {
  normalizeMobileNumber,
  markConversationInbound,
  markConversationOutbound,
} from "../services/whatsapp.service.js";
import { sendQuotationFollowUp, buildQuotationMessage } from "../services/quotation.service.js";

const DELIVERY_RANK = { pending: 0, sent: 1, delivered: 2, read: 3 };

/** Meta calls this when subscribing / re-verifying the webhook URL. */
export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && env.whatsapp.webhookVerifyToken && token && token === env.whatsapp.webhookVerifyToken) {
    logger.info("[WhatsApp] webhook verified");
    return res.status(200).send(challenge);
  }
  logger.warn("[WhatsApp] webhook verification failed");
  return res.sendStatus(403);
};

/**
 * Handle a webhook POST. The body is received as raw bytes (see the route) so
 * the x-hub-signature-256 can be verified before parsing, when a webhook App
 * Secret is configured. Responds 200 immediately and processes events in the
 * background so Meta never sees a slow response / retry storm.
 */
export const receiveWebhook = asyncHandler(async (req, res) => {
  const raw = req.body;
  if (!raw || !Buffer.isBuffer(raw) || !raw.length) return res.sendStatus(400);

  if (env.whatsapp.webhookAppSecret) {
    const signature = req.get("x-hub-signature-256") || "";
    const expected = `sha256=${crypto.createHmac("sha256", env.whatsapp.webhookAppSecret).update(raw).digest("hex")}`;
    const actual = signature.slice("sha256=".length);
    const expectedDigest = expected.slice("sha256=".length);
    const ok = signature && actual.length === expectedDigest.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedDigest));
    if (!ok) {
      logger.warn("[WhatsApp] webhook signature mismatch - event ignored");
      return res.sendStatus(401);
    }
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    logger.warn("[WhatsApp] webhook body is not valid JSON");
    return res.sendStatus(400);
  }

  res.sendStatus(200);
  processWebhookEvents(payload).catch((err) => logger.error(`[WhatsApp] webhook processing error: ${err.message}`));
});

/** Dispatch all entry/changes in a webhook payload (statuses + inbound). */
export const processWebhookEvents = async (payload) => {
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change?.value;
      if (!value) continue;

      if (Array.isArray(value.statuses) && value.statuses.length) {
        for (const status of value.statuses) {
          await applyMessageStatus(status).catch((err) => logger.error(`[WhatsApp] status update error: ${err.message}`));
        }
      }

      if (Array.isArray(value.messages) && value.messages.length) {
        for (const message of value.messages) {
          await handleInboundMessage(message, value).catch((err) => logger.error(`[WhatsApp] inbound handling error: ${err.message}`));
        }
      }
    }
  }
};

/**
 * Delivery status callbacks from Meta (sent / delivered / read / failed) are
 * matched to the stored send logs by message id and persisted. Statuses only
 * move forward (pending -> sent -> delivered -> read); failed is terminal.
 */
const applyMessageStatus = async (status) => {
  const { id, status: next } = status;
  if (!id) return;

  const log = await QuotationSendLog.findOne({
    $or: [{ providerMessageId: id }, { documentMessageId: id }, { templateMessageId: id }],
  });
  if (!log) {
    logger.info(`[WhatsApp] status for unknown message ${id} (${next}) ignored`);
    return;
  }

  if (next === "failed") {
    const detail = status?.errors?.[0]?.message || status?.errors?.[0]?.error_data?.details || "Delivery failed";
    logger.error(`[WhatsApp] message ${id} failed: ${detail}`);
    await QuotationSendLog.updateOne({ _id: log._id }, { $set: { deliveryStatus: "failed", error: detail } });
    if (log.messageType === "template" && log.awaitingReply) {
      await Quotation.updateOne({ _id: log.quotationId }, { $set: { whatsappStatus: "failed", status: "failed" } });
    }
    return;
  }

  const currentRank = DELIVERY_RANK[log.deliveryStatus] ?? 0;
  const nextRank = DELIVERY_RANK[next] ?? 0;
  if (nextRank > currentRank) {
    await QuotationSendLog.updateOne({ _id: log._id }, { $set: { deliveryStatus: next } });
    logger.info(`[WhatsApp] message ${id} -> ${next}`);
  }
};

/**
 * A customer's inbound message: record the (re)opened 24h session, then - if
 * this number has a quotation waiting for a reply - automatically send the
 * personalized message + PDF document follow-up.
 */
const handleInboundMessage = async (message, value) => {
  const digits = normalizeMobileNumber(message?.from);
  if (!digits) return;

  await markConversationInbound(digits, message.id);

  // Atomically claim the newest awaiting-reply log so concurrent inbound
  // events cannot trigger duplicate follow-ups.
  const pending = await QuotationSendLog.findOneAndUpdate(
    { mobileNumber: digits, awaitingReply: true },
    { $set: { awaitingReply: false } },
    { sort: { createdAt: -1 }, new: true }
  );
  if (!pending) {
    logger.info(`[WhatsApp] inbound from ${digits} - no quotation waiting for reply`);
    return;
  }

  const quotation = await Quotation.findById(pending.quotationId);
  if (!quotation) return;

  const result = await sendQuotationFollowUp(quotation);
  await persistWebhookFollowUp({ quotation, digits, result });
};

/** Persist the automated follow-up (text + PDF) sent after a customer reply. */
const persistWebhookFollowUp = async ({ quotation, digits, result }) => {
  const ok = result.status === "success";
  quotation.status = ok ? "sent" : "failed";
  quotation.whatsappStatus = ok ? "sent" : "failed";
  if (ok) quotation.sentAt = new Date();
  await quotation.save();

  await QuotationSendLog.create({
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    clientName: quotation.clientName,
    mobileNumber: quotation.mobile,
    message: buildQuotationMessage(quotation, { includePdfLink: false }),
    status: ok ? "success" : "failed",
    method: "api",
    messageType: "text",
    awaitingReply: false,
    deliveryStatus: ok ? "sent" : "failed",
    sentAt: ok ? new Date() : null,
    pdfUrl: quotation.pdfUrl || "",
    providerMessageId: result.textMessageId || "",
    documentMessageId: result.documentMessageId || "",
    error: ok ? "" : result.error || "Follow-up send failed",
    sentBy: null,
    sentByName: "System (auto)",
  });

  if (result.textMessageId) await markConversationOutbound(digits, result.textMessageId);
  logger.info(`[WhatsApp] follow-up for ${quotation.quotationNumber} -> ${result.status}`);
};
