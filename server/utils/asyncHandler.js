// Wrap async route handlers to forward rejections to the error middleware
export const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;