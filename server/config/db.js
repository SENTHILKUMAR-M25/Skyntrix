import mongoose from "mongoose";
import logger from "../utils/logger.js";

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skyntrix");
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
}