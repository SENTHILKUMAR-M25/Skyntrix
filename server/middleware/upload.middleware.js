import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ApiError from "../utils/ApiError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "../uploads/tmp");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const imageExts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]);
const imageMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);
const pdfMime = new Set(["application/pdf"]);

const imageFilter = (req, file, cb) => {
  if (imageExts.has(path.extname(file.originalname).toLowerCase()) && imageMimes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only image files are allowed (jpeg, png, gif, webp, svg, avif)."));
  }
};

const resumeFilter = (req, file, cb) => {
  if (pdfMime.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only PDF resumes are allowed."));
  }
};

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 15 },
  fileFilter: imageFilter,
}).array("images", 15);

export const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: resumeFilter,
}).single("resume");

export const uploadSettingsFiles = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).fields([
  { name: "logoMain", maxCount: 1 },
  { name: "logoFooter", maxCount: 1 },
  { name: "favicon", maxCount: 1 },
  { name: "ogImage", maxCount: 1 },
]);

// Portfolio: single thumbnail via 'image', multiple gallery via 'images'
export const uploadPortfolioFiles = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 16 },
  fileFilter: imageFilter,
}).fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 15 },
]);

export const uploadDirPath = () => uploadDir;