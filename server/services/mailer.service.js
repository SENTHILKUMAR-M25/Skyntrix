import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
};

const isConfigured = () => !!(env.smtp.host && env.smtp.user);

/**
 * Send an email. Returns false without throwing when SMTP is not configured (dev).
 * `attachments` (optional) is passed straight to nodemailer.
 */
export const sendMail = async ({ to, subject, html, text, from, attachments }) => {
  if (env.nodeEnv !== "production" && !isConfigured()) {
    logger.info(`[MAIL SIMULATED] to=${to} subject="${subject}"`);
    return { simulated: true };
  }

  if (!isConfigured()) {
    logger.warn("SMTP not configured - skipping email send.");
    return { skipped: true };
  }

  const info = await getTransporter().sendMail({
    from: from || env.smtp.from,
    to,
    subject,
    html,
    text,
    attachments,
  });

  logger.info(`Email sent to ${to} (msgId: ${info.messageId})`);
  return info;
};

export const sendLeadNotification = (lead) =>
  sendMail({
    to: env.seed.email,
    subject: `New Project Inquiry - ${lead.name}`,
    html: leadEmailTemplate(lead),
  });

export const sendCareerNotification = (application) =>
  sendMail({
    to: env.seed.email,
    subject: `New Career Application - ${application.name}`,
    html: careerEmailTemplate(application),
  });

export const sendNewsletterWelcome = (email) =>
  sendMail({
    to: email,
    subject: "Welcome to Skyntrix Newsletter",
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px">
        <h2>Welcome aboard! 🎉</h2>
        <p>Thanks for subscribing to the Skyntrix newsletter. Expect insights on web design, development and digital growth — straight to your inbox.</p>
        <p>— Team Skyntrix</p>
      </div>`,
  });

export const sendResetPassword = (email, resetUrl) =>
  sendMail({
    to: email,
    subject: "Reset your Skyntrix password",
    html: `
      <div style="font-family:Arial">
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 15 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });

const leadEmailTemplate = (lead) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#6D28D9">New Contact Lead</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row("Name", lead.name)}
      ${row("Email", lead.email)}
      ${row("Phone", lead.phone || "—")}
      ${row("Company", lead.company || "—")}
      ${row("Service", lead.service || "—")}
      ${row("Budget", lead.budget || "—")}
    </table>
    ${lead.message ? `<p style="margin-top:16px"><strong>Message:</strong><br/>${lead.message}</p>` : ""}
  </div>`;

const careerEmailTemplate = (app) => `
  <div style="font-family:Arial">
    <h2 style="color:#6D28D9">New Career Application</h2>
    <table style="width:100%%">
      ${row("Name", app.name)}
      ${row("Email", app.email)}
      ${row("Phone", app.phone || "—")}
      ${row("Position", app.position || "—")}
      ${row("Experience", app.experience || "—")}
    </table>
    ${app.message ? `<p><strong>Message:</strong><br/>${app.message}</p>` : ""}
    ${app.resume ? `<p><a href="${app.resume}">Download Resume</a></p>` : ""}
  </div>
`;

const row = (label, value) => `
  <tr>
    <td style="padding:6px 0;color:#64748B;width:120px;font-weight:600">${label}</td>
    <td style="padding:6px 0">${value}</td>
  </tr>
`;