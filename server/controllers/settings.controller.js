import WebsiteSettings from "../models/WebsiteSettings.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const getSingleton = async () => WebsiteSettings.getSingleton();

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  return ApiResponse.ok(res, "Settings fetched", settings);
});

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  return ApiResponse.ok(res, "Settings fetched", settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getSingleton();
  const files = req.files || {};

  const mapUpload = async (field, folder, existingId) => {
    const file = files[field]?.[0];
    if (!file) return null;
    const img = await uploadFile(file, { folder });
    if (existingId) await deleteFile(existingId);
    return img;
  };

  const logoMain = await mapUpload("logoMain", "skyntrix/settings", settings.logo?.mainPublicId);
  const logoFooter = await mapUpload("logoFooter", "skyntrix/settings", settings.logo?.footerPublicId);
  const favicon = await mapUpload("favicon", "skyntrix/settings", settings.logo?.faviconPublicId);
  const ogImage = await mapUpload("ogImage", "skyntrix/settings", settings.seo?.ogImagePublicId);

  const body = req.body || {};
  const safeParse = (str) => {
    try { return JSON.parse(str); } catch (e) { return {}; }
  };
  const ensureObj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : safeParse(o));

  const updates = {};

  const company = ensureObj(body.company);
  if (body.company) updates.company = { ...settings.company, ...company };
  const social = ensureObj(body.social);
  if (body.social) updates.social = { ...settings.social, ...social };
  const seo = ensureObj(body.seo);
  if (body.seo) updates.seo = { ...settings.seo, ...seo };
  const footer = ensureObj(body.footer);
  if (body.footer) updates.footer = { ...settings.footer, ...footer };
  const analytics = ensureObj(body.analytics);
  if (body.analytics) updates.analytics = { ...(settings.analytics || {}), ...analytics };
  if (body.googleAnalytics) updates["analytics.googleAnalytics"] = body.googleAnalytics;
  if (body.googleTagManager) updates["analytics.googleTagManager"] = body.googleTagManager;

  if (logoMain) updates["logo.main"] = logoMain.url, updates["logo.mainPublicId"] = logoMain.public_id;
  if (logoFooter) updates["logo.footer"] = logoFooter.url, updates["logo.footerPublicId"] = logoFooter.public_id;
  if (favicon) updates["logo.favicon"] = favicon.url, updates["logo.faviconPublicId"] = favicon.public_id;
  if (ogImage) updates["seo.ogImage"] = ogImage.url, updates["seo.ogImagePublicId"] = ogImage.public_id;

  if (Object.keys(updates).length) await settings.updateOne({ $set: updates });
  const updated = await getSingleton();

  return ApiResponse.ok(res, "Settings updated", updated);
});