import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import logger from "./utils/logger.js";

const startServer = async () => {
  try {
    await connectDB();

    // Graceful shutdown on SIGINT / SIGTERM
    const server = app.listen(env.port, () => {
      logger.info(`✅ Skyntrix API running at http://localhost:${env.port} (${env.nodeEnv})`);
      logger.info(`Health check: http://localhost:${env.port}${env.apiPrefix}/health`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
      });
      // Force close if not finished in 10s
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

startServer();