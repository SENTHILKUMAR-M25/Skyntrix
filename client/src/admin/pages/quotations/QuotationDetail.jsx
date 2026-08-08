import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaEdit, FaTrash, FaDownload, FaWhatsapp, FaBuilding, FaPhoneAlt, FaEnvelope,
  FaUserTie, FaProjectDiagram, FaCalendarCheck, FaFilePdf, FaCopy, FaExternalLinkAlt, FaRedoAlt,
  FaCheckCircle, FaBan, FaFileInvoiceDollar,
} from "react-icons/fa";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Loading, Modal, PageHeader, Textarea } from "../../components/Ui";
import QuotationPreviewModal from "../../components/quotations/QuotationPreviewModal";
import {
  formatMoney, formatMobileNumber, formatDate, fullDateTime, timeAgo,
  downloadQuotationPdf,
} from "../../utils/quotation";

const STATUS_BADGE = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};
const WA_BADGE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};
const LOG_BADGE = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  fallback: "bg-blue-100 text-blue-700 border-blue-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  template: "bg-amber-100 text-amber-700 border-amber-200",
};
const ACCEPTANCE_BADGE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedLog, setCopiedLog] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const fetchQuotation = useCallback(async () => {
    try {
      const res = await adminGet(`/quotations/${id}`);
      setQuotation(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await adminGet(`/quotations/${id}/logs?limit=25`);
      setLogs(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchQuotation(); }, [fetchQuotation]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleDownload = async () => {
    try {
      await downloadQuotationPdf(id, `${quotation.quotationNumber}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await adminPost(`/quotations/${id}/resend`);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("Quotation sent on WhatsApp");
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Quotation send failed");
      }
      setPreview(false);
      fetchQuotation();
      fetchLogs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminDelete(`/quotations/${id}`);
      toast.ok("Quotation deleted");
      navigate("/admin/quotations");
    } catch (e) {
      toast.error(e.message);
      setDeleteTarget(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await adminPost(`/quotations/${id}/approve`);
      toast.ok("Quotation accepted - moving the contact forward");
      fetchQuotation();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await adminPost(`/quotations/${id}/reject`, { reason: rejectReason.trim() });
      toast.ok("Quotation rejected");
      setRejectOpen(false);
      setRejectReason("");
      fetchQuotation();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRejecting(false);
    }
  };

  if (loading) return <Loading label="Loading quotation..." />;
  if (!quotation) return <EmptyState title="Quotation not found" />;

  const infoRows = [
    { icon: FaBuilding, label: "Business", value: quotation.businessName || "—" },
    { icon: FaPhoneAlt, label: "Mobile", value: formatMobileNumber(quotation.mobile), href: `tel:${quotation.mobile}` },
    { icon: FaEnvelope, label: "Email", value: quotation.email || "—", href: quotation.email ? `mailto:${quotation.email}` : null },
    { icon: FaProjectDiagram, label: "Project", value: quotation.projectName },
    { icon: FaCalendarCheck, label: "Timeline", value: quotation.projectTimeline || "—" },
    { icon: FaUserTie, label: "Created by", value: quotation.createdByName || "System" },
    { icon: FaCalendarCheck, label: "Created", value: fullDateTime(quotation.createdAt) },
    ...(quotation.sentAt ? [{ icon: FaWhatsapp, label: "Sent at", value: fullDateTime(quotation.sentAt) }] : []),
    { icon: FaCalendarCheck, label: "Valid until", value: formatDate(quotation.validUntil) },
  ];

  return (
    <div>
      <button onClick={() => navigate("/admin/quotations")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to quotations
      </button>

      <PageHeader
        title={`Quotation ${quotation.quotationNumber || ""}`}
        subtitle="View the quotation, download the PDF and track WhatsApp delivery."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/quotations/${id}/edit`)}>
              <FaEdit /> Edit
            </Button>
            <Button variant="secondary" onClick={handleDownload}>
              <FaDownload /> Download PDF
            </Button>
            {quotation.acceptanceStatus === "accepted" && (
              <Button onClick={() => navigate(`/admin/invoices/create?quotationId=${id}`)} className="bg-primary-gradient">
                <FaFileInvoiceDollar /> Create Invoice
              </Button>
            )}
            {quotation.acceptanceStatus === "pending" && (
              <>
                <Button variant="danger" onClick={() => setRejectOpen(true)}>
                  <FaBan /> Reject
                </Button>
                <Button onClick={handleAccept} loading={accepting}>
                  <FaCheckCircle /> Accept
                </Button>
              </>
            )}
            <Button onClick={() => setPreview(true)} className="bg-[#25D366] hover:bg-[#1fb959]">
              <FaWhatsapp /> {quotation.whatsappStatus === "sent" ? "Send Again" : "Send WhatsApp"}
            </Button>
            {canDelete && (
              <Button variant="danger" onClick={() => setDeleteTarget(true)}>
                <FaTrash />
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[quotation.status] || STATUS_BADGE.draft}`}>{quotation.status}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${WA_BADGE[quotation.whatsappStatus] || WA_BADGE.pending}`}>WhatsApp: {quotation.whatsappStatus}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ACCEPTANCE_BADGE[quotation.acceptanceStatus] || ACCEPTANCE_BADGE.pending}`}>
          Client: {quotation.acceptanceStatus || "pending"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">Grand Total: <span className="text-primary">{formatMoney(quotation.totalAmount)}</span></span>
        {quotation.acceptanceStatus === "rejected" && quotation.rejectionReason && (
          <span className="text-xs text-red-600" title={quotation.rejectionReason}>
            Rejection reason: {quotation.rejectionReason}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Left column */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Client details</h2>
            <div className="space-y-3">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <row.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ink/40">{row.label}</div>
                    {row.href ? (
                      <a href={row.href} className="break-words text-sm font-medium text-primary hover:underline">{row.value}</a>
                    ) : (
                      <div className="break-words text-sm font-medium text-ink/80">{row.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {quotation.pdfUrl && (
            <div className="card p-5">
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">PDF</h2>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-base/80 px-3 py-2 text-sm">
                <a href={`${quotation.pdfUrl}?v=${encodeURIComponent(quotation.updatedAt || Date.now())}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 break-all text-primary hover:underline">
                  <FaFilePdf className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate">{quotation.pdfUrl.split("/").pop()}</span>
                </a>
                <button onClick={handleDownload} className="shrink-0 text-ink/30 hover:text-primary" title="Download PDF"><FaDownload /></button>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink/50">Advance amount</span><span className="font-semibold text-ink">{formatMoney(quotation.advanceAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink/50">Payment terms</span><span className="max-w-[60%] text-right text-ink/80">{quotation.paymentTerms || "—"}</span></div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Services */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Service cost breakdown</h2>
            </div>
            {!quotation.services?.length ? (
              <EmptyState title="No line items" hint="This quotation uses a manually entered total amount." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-base text-sm">
                  <thead className="bg-base/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">Service</th>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-ink/60">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base">
                    {quotation.services.map((s, i) => (
                      <tr key={i} className="transition-colors hover:bg-base/40">
                        <td className="px-4 py-3 text-ink/40">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                        <td className="max-w-[260px] px-4 py-3 text-ink/60">{s.description || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">{formatMoney(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-primary/5">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-ink">GRAND TOTAL</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-primary">{formatMoney(quotation.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Scope & notes */}
          {quotation.projectDescription && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Project scope</h2>
              <p className="text-sm leading-relaxed text-ink/70">{quotation.projectDescription}</p>
            </div>
          )}
          {quotation.additionalNotes && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Additional notes</h2>
              <p className="text-sm leading-relaxed text-ink/70">{quotation.additionalNotes}</p>
            </div>
          )}

          {/* Send logs */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">WhatsApp send logs</h2>
              <p className="mt-0.5 text-xs text-ink/40">Every send attempt for this quotation with delivery status.</p>
            </div>
            <div className="p-4">
              {logsLoading ? (
                <Loading label="Loading logs..." />
              ) : logs.length === 0 ? (
                <EmptyState title="No send attempts yet" hint="Send this quotation on WhatsApp to log the delivery." />
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log._id} className="rounded-xl border border-base bg-base/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${LOG_BADGE[log.status] || LOG_BADGE.failed}`}>{log.status}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-ink/50">{log.method === "api" ? "Cloud API" : "WhatsApp Web"}</span>
                          {log.isRetry && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">retry</span>}
                          {log.awaitingReply && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">awaiting reply</span>}
                        </div>
                        <span className="text-xs text-ink/45" title={fullDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                      </div>

                      <div className="mt-2 flex items-start gap-2">
                        <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-ink/60 line-clamp-3" title={log.message}>{log.message}</p>
                        <button
                          onClick={() => { copy(log.message); setCopiedLog(log._id); setTimeout(() => setCopiedLog(""), 1400); }}
                          className="shrink-0 rounded-md p-1.5 text-ink/30 hover:bg-primary/10 hover:text-primary"
                          title="Copy message"
                        >
                          {copiedLog === log._id ? <span className="text-[10px] text-emerald-600">copied</span> : <FaCopy className="h-3 w-3" />}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/45">
                        <span>To: <span className="text-ink/70">{log.clientName} ({formatMobileNumber(log.mobileNumber)})</span></span>
                        <span>Sent by: <span className="text-ink/70">{log.sentByName}</span></span>
                        {log.providerMessageId && <span>Msg id: <span className="text-ink/70">{log.providerMessageId}</span></span>}
                        {log.error && <span className="text-red-600">Error: {log.error}</span>}
                        <span className="text-ink/40">{fullDateTime(log.createdAt)}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {log.waUrl && (
                          <a href={log.waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-base bg-white px-2 py-1 text-[11px] font-medium text-[#128C4B] hover:border-emerald-300">
                            <FaExternalLinkAlt className="h-2.5 w-2.5" /> Open wa.me link
                          </a>
                        )}
                        {log.pdfUrl && (
                          <a href={log.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-base bg-white px-2 py-1 text-[11px] font-medium text-primary hover:border-primary/40">
                            <FaFilePdf className="h-2.5 w-2.5 text-red-500" /> PDF link
                          </a>
                        )}
                        {(log.status === "failed" || log.status === "fallback") && (
                          <button onClick={() => setPreview(true)} className="inline-flex items-center gap-1 rounded-md border border-base bg-white px-2 py-1 text-[11px] font-medium text-ink/70 hover:border-primary/40">
                            <FaRedoAlt className="h-2.5 w-2.5" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <QuotationPreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        quotation={quotation}
        onSend={handleResend}
        sending={sending}
        title={quotation.whatsappStatus === "sent" ? "Resend quotation on WhatsApp" : "Send quotation on WhatsApp"}
      />

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject quotation" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleReject} loading={rejecting}>Reject quotation</Button>
        </>}>
        <div className="space-y-3">
          <p className="text-ink/70">
            Mark <span className="font-semibold">{quotation.quotationNumber}</span> as rejected by the client. The contact will stop here in the pipeline.
          </p>
          <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)" />
        </div>
      </Modal>

      <Modal open={deleteTarget} onClose={() => setDeleteTarget(false)} title="Delete quotation" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this quotation, its PDF and WhatsApp send logs? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
