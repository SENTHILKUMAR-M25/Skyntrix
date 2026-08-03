import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import { listDocuments, getById } from "../services/query.service.js";
import ApiError from "../utils/ApiError.js";

/**
 * Factory that builds a full CRUD controller set for a model with sensible defaults.
 * Override via options.
 */
export const createCrudController = (Model, options = {}) => {
  const {
    searchFields = [],
    defaultSort = { createdAt: -1 },
    statusField = "status",
    populate = "",
    select = "-__v",
    allowedPublic = true,
    publicFilter = null,
    documentName = Model.modelName,
  } = options;

  // --- PUBLIC (no auth) ---
  const listPublic = asyncHandler(async (req, res) => {
    const { data, meta } = await listDocuments(Model, req, {
      searchFields,
      defaultSort,
      statusField,
      publicOnly: true,
      publicFilter,
    });
    return ApiResponse.ok(res, `${documentName} fetched`, data, meta);
  });

  // Group by slug for public detail
  const detailPublic = asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ slug: req.params.slug, [statusField]: "published" });
    if (!doc) throw ApiError.notFound(`${documentName} not found`);
    return ApiResponse.ok(res, `${documentName} fetched`, doc);
  });

  // --- ADMIN (auth protected) ---
  const list = asyncHandler(async (req, res) => {
    const { data, meta } = await listDocuments(Model, req, { searchFields, defaultSort, statusField });
    return ApiResponse.ok(res, `${documentName} list fetched`, data, meta);
  });

  const create = asyncHandler(async (req, res, next) => {
    const doc = await Model.create(req.body);
    return ApiResponse.created(res, `${documentName} created`, doc);
  });

  const detail = asyncHandler(async (req, res) => {
    const doc = await getById(Model, req.params.id, { select, populates: populate ? [populate] : [] });
    return ApiResponse.ok(res, `${documentName} fetched`, doc);
  });

  const update = asyncHandler(async (req, res) => {
    let doc = await getById(Model, req.params.id);
    doc.set(req.body);
    await doc.save();
    return ApiResponse.ok(res, `${documentName} updated`, doc);
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) throw ApiError.notFound(`${documentName} not found`);
    return ApiResponse.ok(res, `${documentName} deleted`);
  });

  const updateStatus = asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, { [statusField]: req.body.status }, { new: true });
    if (!doc) throw ApiError.notFound(`${documentName} not found`);
    return ApiResponse.ok(res, `${documentName} status updated`, doc);
  });

  return {
    listPublic,
    detailPublic,
    list,
    create,
    detail,
    update,
    remove,
    updateStatus,
  };
};

export default createCrudController;