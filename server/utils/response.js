export class ApiResponse {
  constructor(success, message, data = null, meta = null, statusCode = 200) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== null && data !== undefined) this.data = data;
    if (meta) this.meta = meta;
  }

  static ok(res, message = "Success", data = null, meta = null, statusCode = 200) {
    return res.status(statusCode).json(new ApiResponse(true, message, data, meta, statusCode));
  }

  static created(res, message = "Created", data = null) {
    return ApiResponse.ok(res, message, data, null, 201);
  }

  static noContent(res) {
    return res.status(204).end();
  }
}

// Standard pagination meta builder
export const getPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  totalItems: total,
  totalPages: Math.ceil(total / limit) || 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

export default ApiResponse;