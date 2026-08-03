import ApiError from "../utils/ApiError.js";

/**
 * Restrict access to specific roles. Usage: authorizeRoles('super-admin', 'admin')
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(ApiError.unauthorized("Not authorized."));
    }
    if (!roles.includes(req.admin.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action."));
    }
    next();
  };
};

/**
 * Allow super-admin to pass, and gate the action by a permission flag.
 * The action maps to req.method. Usage: requirePermission('delete')
 */
export const requirePermission = (actionName) => {
  const actionMap = {
    get: "viewAnalytics", // read-based analytics gate
    create: "create",
    update: "update",
    delete: "delete",
    publish: "publish",
  };
  const flag = actionMap[actionName] || "update";

  return (req, res, next) => {
    if (!req.admin) return next(ApiError.unauthorized("Not authorized."));
    if (req.admin.role === "super-admin") return next();
    if (!req.admin.permissions || req.admin.permissions[flag]) return next();
    return next(ApiError.forbidden(`Missing '${flag}' permission.`));
  };
};

export default authorizeRoles;