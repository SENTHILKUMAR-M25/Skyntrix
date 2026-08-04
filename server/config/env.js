import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const bool = (v) => v === "true";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  appUrl: process.env.APP_URL || "http://localhost:5173",
  uploadUrl: process.env.UPLOADS_URL || "http://localhost:5000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminUrl: process.env.ADMIN_URL || "http://localhost:5173",
  apiPrefix: process.env.API_PREFIX || "/api",
  isProd: process.env.NODE_ENV === "production",

  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skyntrix",
  databaseUrl: process.env.DATABASE_URL || "",

  qpJwt: {
    secret: process.env.QUICKPARK_JWT_SECRET || "quickpark-jwt-secret",
    expiresIn: process.env.QUICKPARK_JWT_EXPIRES_IN || "1d",
    refreshSecret: process.env.QUICKPARK_REFRESH_SECRET || "quickpark-refresh-secret",
    refreshExpiresIn: process.env.QUICKPARK_REFRESH_EXPIRES_IN || "7d",
    cookieName: process.env.QUICKPARK_COOKIE_NAME || "quickpark_at",
    refreshCookieName: process.env.QUICKPARK_REFRESH_COOKIE_NAME || "quickpark_rt",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "skyntrix-jwt-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || "skyntrix-refresh-secret",
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    cookieName: process.env.JWT_COOKIE_NAME || "skyntrix_at",
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || "skyntrix_rt",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    folder: process.env.CLOUDINARY_FOLDER || "skyntrix",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "Skyntrix Technologies <no-reply@skyntrix.com>",
  },

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v19.0",
    website: process.env.WHATSAPP_WEBSITE || "https://skyntrix.vercel.app/",
  },

  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 50,
  },

  seed: {
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    email: process.env.SEED_ADMIN_EMAIL || "admin@skyntrix.com",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@12345",
    role: process.env.SEED_ADMIN_ROLE || "super-admin",
  },
};