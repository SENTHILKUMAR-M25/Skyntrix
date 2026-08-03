import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

/**
 * Runs the array of express-validator chains and returns standardized error.
 * Usage: router.post('/', validate([ body('name').notEmpty() ]), handler)
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
      value: e.value,
    }));

    return next(ApiError.badRequest("Validation failed", formatted));
  };
};

export default validate;