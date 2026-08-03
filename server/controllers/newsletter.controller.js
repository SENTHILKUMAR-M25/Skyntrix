import Newsletter from "../models/Newsletter.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { sendNewsletterWelcome } from "../services/mailer.service.js";

// PUBLIC - subscribe (no duplicate)
export const subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) throw ApiError.badRequest("Email is required");

  let sub = await Newsletter.findOne({ email });
  if (sub) {
    if (!sub.isActive) {
      sub.isActive = true;
      await sub.save();
      return ApiResponse.ok(res, "Subscription reactivated", sub);
    }
    return ApiResponse.ok(res, "You are already subscribed.");
  }

  sub = await Newsletter.create({ email });
  // best-effort welcome email
  sendNewsletterWelcome(email).catch(() => {});
  return ApiResponse.created(res, "Subscribed successfully!", sub);
});

// ADMIN - list with search/pagination
export const listSubscribers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = (req.query.search || "").trim();

  const filter = {};
  if (search) {
    filter.email = new RegExp(search, "i");
  }
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;

  const [data, total] = await Promise.all([
    Newsletter.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Newsletter.countDocuments(filter),
  ]);

  return ApiResponse.ok(res, "Subscribers fetched", data, {
    page, limit, totalItems: total, totalPages: Math.ceil(total / limit),
  });
});

export const deleteSubscriber = asyncHandler(async (req, res) => {
  const doc = await Newsletter.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Subscriber not found");
  return ApiResponse.ok(res, "Subscriber deleted");
});

// Export CSV
export const exportCsv = asyncHandler(async (req, res) => {
  const rows = await Newsletter.find({}).sort({ createdAt: -1 }).lean();
  const header = "email,subscribedAt,status";
  const body = rows
    .map((r) => `${r.email},${new Date(r.subscribedAt).toISOString()},${r.isActive ? "active" : "inactive"}`)
    .join("\n");
  const csv = `${header}\n${body}`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=newsletter-${Date.now()}.csv`);
  return res.send(csv);
});