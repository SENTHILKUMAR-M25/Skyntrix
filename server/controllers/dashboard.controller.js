import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import Lead from "../models/Lead.model.js";
import Career from "../models/Career.model.js";
import Newsletter from "../models/Newsletter.model.js";
import Blog from "../models/Blog.model.js";
import Service from "../models/Service.model.js";
import Portfolio from "../models/Portfolio.model.js";
import Team from "../models/Team.model.js";
import Testimonial from "../models/Testimonial.model.js";
import AuditLog from "../models/AuditLog.model.js";

const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CHART_PERIODS = ["7d", "30d", "90d", "year", "all"];
const CHART_CACHE_TTL = 60 * 1000; // 60s
const chartCache = new Map(); // key -> { ts, data }

export const invalidateChartsCache = () => chartCache.clear();

const pad2 = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const monthKey = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;

// Week start (Sunday) matching MongoDB $dateTrunc unit: "week" (UTC).
const utcWeekStart = (d) => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt;
};

// Build ordered buckets (key + label) for a period.
const buildBuckets = (period, start, now) => {
  const buckets = [];
  if (period === "7d" || period === "30d") {
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    while (cur <= now) {
      buckets.push({ key: dateKey(cur), label: `${LABELS[cur.getUTCMonth()]} ${cur.getUTCDate()}` });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else if (period === "90d") {
    const cur = utcWeekStart(start);
    while (cur <= now) {
      buckets.push({ key: dateKey(cur), label: `${LABELS[cur.getUTCMonth()]} ${cur.getUTCDate()}` });
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  } else {
    // year / all -> monthly
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= now) {
      buckets.push({
        key: monthKey(cur),
        label: `${LABELS[cur.getUTCMonth()]} '${String(cur.getUTCFullYear()).slice(2)}`,
      });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  }
  return buckets;
};

// Count docs per bucket for a model. Returns array aligned to `buckets`.
const countByBucket = async (Model, buckets, period, start) => {
  const match = start ? { createdAt: { $gte: start } } : {};
  let groupId;
  if (period === "year" || period === "all") {
    groupId = { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } };
  } else if (period === "90d") {
    groupId = { $dateTrunc: { date: "$createdAt", unit: "week", timezone: "UTC" } };
  } else {
    groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } };
  }

  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: groupId, count: { $sum: 1 } } },
  ]);

  const counts = new Map(
    rows.map((r) => [
      period === "90d" ? dateKey(new Date(r._id)) : r._id,
      r.count,
    ])
  );
  return buckets.map((b) => counts.get(b.key) || 0);
};

// Earliest createdAt across leads & applications (used by "all time").
const earliestCreatedAt = async () => {
  const [lead, career] = await Promise.all([
    Lead.findOne({}).sort({ createdAt: 1 }).select("createdAt").lean(),
    Career.findOne({}).sort({ createdAt: 1 }).select("createdAt").lean(),
  ]);
  const a = lead?.createdAt, b = career?.createdAt;
  return a && b ? (a < b ? a : b) : a || b || null;
};

const periodStart = async (period) => {
  const now = new Date();
  if (period === "7d") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  if (period === "30d") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  if (period === "90d") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89));
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const earliest = await earliestCreatedAt();
  return earliest
    ? new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1))
    : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
};

const buildCharts = async (period) => {
  const now = new Date();
  const start = await periodStart(period);
  const buckets = buildBuckets(period, start, now);
  const [leads, applications] = await Promise.all([
    countByBucket(Lead, buckets, period, start),
    countByBucket(Career, buckets, period, start),
  ]);
  return {
    period,
    labels: buckets.map((b) => b.label),
    leads,
    applications,
  };
};

export const getCharts = asyncHandler(async (req, res) => {
  const period = CHART_PERIODS.includes(req.query.period) ? req.query.period : "year";
  const cacheKey = `charts:${period}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHART_CACHE_TTL) {
    return ApiResponse.ok(res, "Charts data", cached.data);
  }

  const data = await buildCharts(period);
  chartCache.set(cacheKey, { ts: Date.now(), data });
  return ApiResponse.ok(res, "Charts data", data);
});

export const getOverview = asyncHandler(async (req, res) => {
  const [
    totalLeads,
    newLeads,
    convertedLeads,
    totalPortfolio,
    publishedPortfolio,
    totalBlogs,
    publishedBlogs,
    totalServices,
    totalTeam,
    totalTestimonials,
    totalApplications,
    newApplications,
    totalSubscribers,
    totalViews,
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: "new" }),
    Lead.countDocuments({ status: "converted" }),
    Portfolio.countDocuments(),
    Portfolio.countDocuments({ status: "published" }),
    Blog.countDocuments(),
    Blog.countDocuments({ status: "published" }),
    Service.countDocuments(),
    Team.countDocuments(),
    Testimonial.countDocuments({ status: "published" }),
    Career.countDocuments(),
    Career.countDocuments({ status: "new" }),
    Newsletter.countDocuments({ isActive: true }),
    Blog.aggregate([{ $group: { _id: null, views: { $sum: "$views" } } }]).then((r) => r[0]?.views || 0),
  ]);

  return ApiResponse.ok(res, "Dashboard overview", {
    totals: {
      leads: totalLeads,
      newLeads,
      convertedLeads,
      portfolio: totalPortfolio,
      publishedPortfolio,
      blogs: totalBlogs,
      publishedBlogs,
      services: totalServices,
      team: totalTeam,
      testimonials: totalTestimonials,
      careerApplications: totalApplications,
      newApplications,
      newsletterSubscribers: totalSubscribers,
      totalBlogViews: totalViews,
    },
  });
});

export const getRecentActivity = asyncHandler(async (req, res) => {
  const [latestLeads, latestCareer, latestNews, auditLogs] = await Promise.all([
    Lead.find({}).sort({ createdAt: -1 }).limit(5).select("name email status createdAt").lean(),
    Career.find({}).sort({ createdAt: -1 }).limit(5).select("name position status createdAt").lean(),
    Newsletter.find({}).sort({ createdAt: -1 }).limit(5).select("email isActive createdAt").lean(),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(8).select("action adminEmail createdAt").lean(),
  ]);

  const items = [
    ...latestLeads.map((l) => ({ type: "lead", title: `New lead: ${l.name}`, desc: `${l.email} (${l.status})`, time: l.createdAt })),
    ...latestCareer.map((c) => ({ type: "career", title: `Care: ${c.name}`, desc: `${c.position} (${c.status})`, time: c.createdAt })),
    ...latestNews.map((n) => ({ type: "newsletter", title: "New subscriber", desc: n.email, time: n.createdAt })),
    ...auditLogs.map((a) => ({ type: "audit", title: a.action, desc: a.adminEmail || "system", time: a.createdAt })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12);

  return ApiResponse.ok(res, "Recent activity", items);
});