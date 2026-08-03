import AuditLog from "../models/AuditLog.model.js";

/**
 * Records an audit event. Assumes req.admin exists (call after protect).
 * Usage: auditLog(req, 'create', 'Service', doc._id, 'Created service')
 */
export const auditLog = async (req, action, resource = "", resourceId = null, description = "", meta = {}) => {
  try {
    await AuditLog.create({
      adminId: req.admin?._id,
      adminEmail: req.admin?.email,
      action,
      resource,
      resourceId,
      description,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"] || "",
      meta,
    });
  } catch (err) {
    // Logging failure should never break the request flow
    console.error("Audit log failed:", err.message);
  }
};

/**
 * Express middleware to persist a request log entry (non-blocking).
 */
export const auditRequest = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.admin && res.statusCode >= 400) {
      auditLog(req, "request", req.baseUrl || "", null, `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
};

export default auditLog;