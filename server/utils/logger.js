import pino from "pino";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "../logs");

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const isProd = process.env.NODE_ENV === "production";

const targets = [
  {
    target: "pino/file",
    options: { destination: path.join(logDir, "app.log"), mkdir: true },
    level: "info",
  },
  {
    target: "pino/file",
    options: { destination: path.join(logDir, "error.log"), mkdir: true },
    level: "error",
  },
  {
    target: "pino/file",
    options: { destination: path.join(logDir, "request.log"), mkdir: true },
    level: "http",
  },
];

// Keep pretty console output in dev for readability
if (!isProd) {
  targets.push({
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard" },
    level: "debug",
  });
}

const logger = pino({
  name: "skyntrix-api",
  level: isProd ? "info" : "debug",
  transport: { targets },
});

export default logger;