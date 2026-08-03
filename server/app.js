import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import { auditRequest } from "./middleware/audit.middleware.js";
import logger from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// --- Security ----
app.use(helmet());
app.disable("x-powered-by");

// --- CORS ----
const allowedOrigins = env.corsOrigins;
app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no origin (curl, server-to-server) in any env
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || !env.isProd) return cb(null, true);
      return cb(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
  })
);

// --- Body parsing (limit to reasonable size) ---
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// --- Security hardening ---
app.use(mongoSanitize());
app.use(xss());

// --- Perf ---
app.use(compression());

// --- Logging ---
app.use(morgan(env.isProd ? "combined" : "dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// --- Audit (non-blocking request logging) ---
app.use(auditRequest);

// --- Static: uploaded local files fallback ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Rate limiting applied to all API routes ---
app.use(env.apiPrefix, apiLimiter);

// --- Routes ---
app.use(env.apiPrefix, routes);

// --- Serve built React client in production (or when dist exists) ---
const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  // SPA fallback: serve index.html for any non-API, non-asset route
  app.get("*", (req, res, next) => {
    if (req.path.startsWith(env.apiPrefix) || req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;