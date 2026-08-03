import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", index: true },
    adminEmail: { type: String },
    action: { type: String, required: true, index: true }, // e.g. "login", "failed_login", "create", "update", "delete"
    resource: { type: String, default: "" }, // e.g. "Service", "Portfolio"
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;