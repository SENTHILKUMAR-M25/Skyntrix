// One-off migration: rewrite any stored absolute localhost upload URLs
// (http://localhost:5173/uploads/... or http://localhost:5000/uploads/...)
// to relative /uploads/... paths so thumbnails resolve against the serving origin.
// Usage: node scripts/fix-upload-paths.js
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skyntrix";

const rewrite = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/uploads\//, "/uploads/");
};

const walk = (obj) => {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) obj[i] = walk(obj[i]);
    return obj;
  }
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) obj[key] = walk(obj[key]);
    return obj;
  }
  return rewrite(obj);
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  let total = 0;

  for (const { name } of cols) {
    const cursor = db.collection(name).find({});
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const original = JSON.stringify(doc);
      const fixed = walk(JSON.parse(original));
      delete fixed._id;
      if (JSON.stringify(fixed) !== JSON.stringify(doc)) {
        await db.collection(name).replaceOne({ _id: doc._id }, fixed);
        total++;
        console.log(`fixed: ${name}/${doc._id}`);
      }
    }
  }

  console.log(`\nDone. Updated ${total} document(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
