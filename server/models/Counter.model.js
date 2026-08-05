import mongoose from "mongoose";

/**
 * Atomic, per-scope sequence counter used to generate unique document numbers
 * (e.g. quotation numbers like SKT-2026-0001). findOneAndUpdate with $inc is
 * atomic so two concurrent requests can never receive the same sequence value.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const nextSequence = async (key) => {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
};

const Counter = mongoose.model("Counter", counterSchema);
export default Counter;
