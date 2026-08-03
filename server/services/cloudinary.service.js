import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";

const IS_CONFIGURED = !!(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

// Local fallback directory for when Cloudinary env vars are absent (dev)
const localDir = path.resolve("uploads");
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

const uploadToCloudinary = (filePath, options) =>
  cloudinary.uploader.upload(filePath, options);

const uploadToLocal = (filePath, resourceType) => {
  const fileName = path.basename(filePath);
  const dest = path.join(localDir, fileName);
  if (path.resolve(filePath) !== path.resolve(dest)) fs.copyFileSync(filePath, dest);
  // Relative path so images resolve against whichever origin serves the page
  // (works in dev via the Vite /uploads proxy and in prod since the backend
  // serves both the client and the /uploads folder).
  const url = `/uploads/${fileName}`;
  let size = 0;
  try { size = fs.statSync(dest).size; } catch (_) {}
  return {
    url,
    secure_url: url,
    public_id: `local/${fileName}`,
    resource_type: resourceType,
    bytes: size,
  };
};

const destroyFromCloudinary = (publicId) =>
  cloudinary.uploader.destroy(publicId);

/**
 * Upload a file (image or pdf) via Cloudinary, or fall back to local storage.
 * @param {File} file Multer file object
 * @param {{ folder?: string, resourceType?: string, transformation?: function }} opts
 */
export const uploadFile = async (file, opts = {}) => {
  const resourceType = opts.resourceType || (file.mimetype === "application/pdf" ? "raw" : "image");
  const transformation = opts.transformation;

  if (!IS_CONFIGURED) {
    logger.warn("Cloudinary not configured - storing upload locally");
    const tmp = uploadToLocal(file.path, resourceType);
    return { ...tmp, local: true };
  }

  const options = {
    folder: opts.folder || env.cloudinary.folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    transformation: resourceType === "image" && transformation ? transformation : undefined,
  };

  if (resourceType === "image") {
    // Auto-compress and optimize images for web delivery
    options.transformation = [
      ...(transformation ? [transformation] : []),
      { fetch_format: "auto", quality: "auto" },
    ];
  }

  const result = await uploadToCloudinary(file.path, options);
  return {
    url: result.secure_url,
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
};

export const deleteFile = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  if (String(publicId).startsWith("local/")) {
    const name = path.basename(publicId);
    const full = path.join(localDir, name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return;
  }
  if (!IS_CONFIGURED) return;
  const res = await destroyFromCloudinary(publicId, { resource_type: resourceType });
  return res;
};

// Extract a public_id from a Cloudinary URL so we can delete it later
export const extractPublicId = (url) => {
  if (!url) return null;
  const match = String(url).match(/\/([^/]+)\/([^/]+?)(?:\.[\w]+)?$/);
  if (!match) return null;
  // e.g. /skyntrix/folder/abcdef -> skyntrix/folder/abcdef (strip extension)
  const full = String(url).split("/").slice(-3).join("/");
  return full.replace(/\.[a-zA-Z0-9]+$/, "");
};

export const removeTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { logger.warn(`Failed to remove temp file: ${e.message}`); }
  }
};

export const cloudSyncConfigured = () => IS_CONFIGURED;