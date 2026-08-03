import ApiError from "../utils/ApiError.js";
import { getPaginationMeta } from "../utils/response.js";

/**
 * Build a Mongoose query from common query params: search, status, sort, page, limit, and optional filters.
 * @param {Model} Model mongoose model
 * @param {object} options
 *  - searchFields: [String] fields for text/$regex search
 *  - defaultSort: Object
 *  - statusField: String name of status field (default 'status')
 */
export const listDocuments = async (Model, req, options = {}) => {
  const {
    searchFields = [],
    defaultSort = { createdAt: -1 },
    statusField = "status",
    extraFilters = {},
    publicOnly = false,
    publicFilter = null,
  } = options;

  const {
    page = 1,
    limit = 10,
    search = "",
    sort,
    status,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = { ...extraFilters };

  if (status && status !== "all") filter[statusField] = status;

  if (publicOnly) {
    if (publicFilter) {
      Object.assign(filter, publicFilter);
    } else {
      filter[statusField] = "published";
    }
  }

  // Build search (OR across desired fields) safely
  if (search && searchFields.length) {
    const searchTerm = String(search).trim();
    if (searchFields.includes("$text")) {
      filter.$text = { $search: searchTerm, $language: options.textLanguage || "en" };
    } else {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = searchFields.map((f) => ({ [f]: regex }));
    }
  }

  const sortObj = sort ? parseSort(sort) : defaultSort;

  const [data, total] = await Promise.all([
    Model.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(),
    Model.countDocuments(filter),
  ]);

  return {
    data,
    meta: getPaginationMeta(pageNum, limitNum, total),
  };
};

export const parseSort = (sort) => {
  // "field:-1" or "field:asc" style; or plain
  if (typeof sort === "string") {
    const [field, dir] = sort.split(":");
    return { [field]: dir === "asc" || dir === "1" ? 1 : -1 };
  }
  return null;
};

export const getById = async (Model, id, { select = "", populates = [] } = {}) => {
  let q = Model.findById(id).select(select);
  if (populates.length) q = q.populate(populates.join(" "));
  const doc = await q;
  if (!doc) throw ApiError.notFound("Resource not found");
  return doc;
};

export const getBySlug = async (Model, slug, { publicOnly = false, statusField = "status" } = {}) => {
  const filter = { slug };
  if (publicOnly) filter[statusField] = "published";
  const doc = await Model.findOne(filter);
  if (!doc) throw ApiError.notFound("Resource not found");
  return doc;
};