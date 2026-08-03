import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const uploadsDirPath = () => uploadDir;

export const removeFile = (filePath) => {
  if (!filePath) return;
  try {
    const full = path.resolve(filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    /* best-effort */
  }
};