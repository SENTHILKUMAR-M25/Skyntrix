export const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const generateUniqueSlug = async (Model, base, excludeId = null) => {
  let slug = slugify(base);
  if (!slug) throw new Error("Unable to generate slug");
  let counter = 1;
  let candidate = slug;
  let existing = await Model.findOne({ slug: candidate, _id: { $ne: excludeId } });
  while (existing) {
    candidate = `${slug}-${counter}`;
    existing = await Model.findOne({ slug: candidate, _id: { $ne: excludeId } });
    counter++;
  }
  return candidate;
};