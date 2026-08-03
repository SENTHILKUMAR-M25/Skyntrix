import { slugify } from "../utils/slugify.js";

export const generateUniqueSlug = async (Model, value, excludeId = null) => {
  let slug = slugify(value);
  if (!slug) slug = "item";
  let candidate = slug;
  let n = 1;
  let doc = await Model.findOne({ slug: candidate, _id: { $ne: excludeId } });
  while (doc) {
    candidate = `${slug}-${++n}`;
    doc = await Model.findOne({ slug: candidate, _id: { $ne: excludeId } });
  }
  return candidate;
};

export default generateUniqueSlug;