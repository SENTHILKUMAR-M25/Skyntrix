import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaDownload, FaWhatsapp, FaEnvelope, FaBuilding, FaUserTie,
  FaCalendarCheck, FaFilePdf, FaCopy,
  FaHashtag, FaIndianRupeeSign, FaWallet, FaCircleCheck,
} from "react-icons/fa6";
import { FaPhoneAlt, FaProjectDiagram, FaRedoAlt } from "react-icons/fa";
import { adminGet, adminPost } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Loading, Modal, PageHeader } from "../../components/Ui";
import ReceiptPreviewModal from "../../components/receipts/ReceiptPreviewModal";
import {
  formatMoney, formatMobileNumber, fullDateTime, timeAgo, downloadReceiptPdf,
} from "../../utils/receipt";

const LOG_BADGE = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  fallback: "bg-blue-100 text-blue-700 border-blue-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  template: "bg-amber-100 text-amber-700 border-amber-200",
};
const DELIVERY_BADGE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-cyan-100 text-cyan-700 border-cyan-200",
  read: "bg-violet-100 text-violet-700 border-violet-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

export default function ReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAuth();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [preview, setPreview] = useState(false);
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [sending, setSending] = useState(false);

  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedLog, setCopiedLog] = useState("");

  const isManager = ["super-admin", "admin"].includes(admin?.role);

  const fetchReceipt = useCallback(async () => {
    try {
      const res = await adminGet(`/receipts/${id}`);
      setReceipt(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await adminGet(`/receipts/${id}/logs?limit=25`);
      setLogs(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchReceipt(); }, [fetchReceipt]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleDownload = async () => {
    try {
      await downloadReceiptPdf(id, `${receipt.receiptNumber}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await adminPost(`/receipts/${id}/resend`, { channel: sendChannel });
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok(data.message || `Receipt sent via ${data.channel || sendChannel}`);
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Receipt send failed");
      }
      setPreview(false);
      fetchReceipt();
      fetchLogs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await adminPost(`/receipts/${id}/regenerate`);
      toast.ok(res.message || "Receipt regenerated");
      setRegenerateOpen(false);
      fetchReceipt();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <Loading label="Loading receipt..." />;
  if (!receipt) return <EmptyState title="Receipt not found" />;

  const infoRows = [
    { icon: FaHashtag, label: "Receipt number", value: receipt.receiptNumber },
    { icon: FaHashtag, label: "Invoice number", value: receipt.invoiceNumber || "—" },
    { icon: FaHashtag, label: "Quotation number", value: receipt.quotationNumber || "—" },
    { icon: FaBuilding, label: "Business", value: receipt.businessName || "—" },
    { icon: FaPhoneAlt, label: "Mobile", value: formatMobileNumber(receipt.mobile), href: `tel:${receipt.mobile}` },
    { icon: FaEnvelope, label: "Email", value: receipt.email || "—", href: receipt.email ? `mailto:${receipt.email}` : null },
    { icon: FaProjectDiagram, label: "Project", value: receipt.projectName },
    { icon: FaCalendarCheck, label: "Payment date", value: fullDateTime(receipt.paidOn) },
    { icon: FaUserTie, label: "Generated by", value: receipt.generatedByName || "System" },
    { icon: FaCalendarCheck, label: "Created", value: fullDateTime(receipt.createdAt) },
    ...(receipt.regeneratedAt ? [{ icon: FaRedoAlt, label: "Last regenerated", value: fullDateTime(receipt.regeneratedAt) }] : []),
  ];

  const paymentRows = [
    ["Payment Method", String(receipt.paymentMethod || "other").replace(/_/g, " ").toUpperCase()],
    ["Transaction ID / UTR", receipt.transactionId || "—"],
    ["Payment Date & Time", fullDateTime(receipt.paidOn)],
    ["Payment Status", String(receipt.paymentStatus || "paid").toUpperCase()],
  ];

  return (
    <div>
      <button onClick={() => navigate("/admin/receipts")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to receipts
      </button>

      <PageHeader
        title={`Receipt ${receipt.receiptNumber || ""}`}
        subtitle="View the payment receipt, resend it via WhatsApp/email or regenerate the PDF."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleDownload}>
              <FaDownload /> Download PDF
            </Button>
            {isManager && (
              <Button variant="secondary" onClick={() => setRegenerateOpen(true)}>
                <FaRedoAlt /> Regenerate
              </Button>
            )}
            <Button onClick={() => { setSendChannel("whatsapp"); setPreview(true); }} className="bg-[#25D366] hover:bg-[#1fb959]">
              <FaWhatsapp /> Send via WhatsApp
            </Button>
            {receipt.email && (
              <Button onClick={() => { setSendChannel("email"); setPreview(true); }}>
                <FaEnvelope /> Send via Email
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Paid</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">Received: <span className="text-primary">{formatMoney(receipt.amountReceived)}</span></span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">Total Paid Till Date: {formatMoney(receipt.totalPaidTillDate)}</span>
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${Number(receipt.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>Remaining: {formatMoney(receipt.remainingBalance)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Left column */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Receipt details</h2>
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

          {receipt.pdfUrl && (
            <div className="card p-5">
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">PDF</h2>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-base/80 px-3 py-2 text-sm">
                <a href={`${receipt.pdfUrl}?v=${encodeURIComponent(receipt.updatedAt || Date.now())}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 break-all text-primary hover:underline">
                  <FaFilePdf className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate">{receipt.pdfUrl.split("/").pop()}</span>
                </a>
                <button onClick={handleDownload} className="shrink-0 text-ink/30 hover:text-primary" title="Download PDF"><FaDownload /></button>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment details</h2>
            <div className="space-y-2.5">
              {paymentRows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-ink/50">{label}</span>
                  <span className="text-right font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {receipt.note && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Note</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{receipt.note}</p>
            </div>
          )}

          {receipt.regenerationCount > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Regeneration history</h2>
              <p className="text-sm text-ink/60">
                Regenerated <span className="font-semibold text-ink">{receipt.regenerationCount} time(s)</span>
                {receipt.regeneratedAt && <> · last on <span className="font-semibold text-ink">{fullDateTime(receipt.regeneratedAt)}</span></>}.
                Resent <span className="font-semibold text-ink">{receipt.resentCount || 0} time(s)</span>.
              </p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Payment summary */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink/50">Project Total</span><span className="font-semibold text-ink">{formatMoney(receipt.projectTotal)}</span></div>
              <div className="flex justify-between"><span className="text-ink/50">Invoice Amount</span><span className="font-semibold text-ink">{formatMoney(receipt.invoiceAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink/50">Previous Payments</span><span className="font-semibold text-ink">{formatMoney(receipt.previousPayments)}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                <span className="inline-flex items-center gap-2 font-semibold text-primary"><FaIndianRupeeSign className="h-3.5 w-3.5" /> Amount Received</span>
                <span className="text-lg font-extrabold text-primary">{formatMoney(receipt.amountReceived)}</span>
              </div>
              <div className="flex justify-between"><span className="inline-flex items-center gap-2 text-ink/50"><FaCircleCheck className="h-3.5 w-3.5 text-emerald-600" /> Total Paid Till Date</span><span className="font-bold text-emerald-600">{formatMoney(receipt.totalPaidTillDate)}</span></div>
              <div className="flex justify-between border-t border-base pt-2"><span className="inline-flex items-center gap-2 text-ink/50"><FaWallet className="h-3.5 w-3.5" /> Remaining Balance</span>
                <span className={`font-bold ${Number(receipt.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(receipt.remainingBalance)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl bg-base/60 p-3 text-sm">
                <div className="flex flex-col"><span className="text-xs text-ink/45">Paid on this invoice</span><span className="font-semibold text-ink">{formatMoney(receipt.amountPaidOnInvoice)}</span></div>
                <div className="flex flex-col"><span className="text-xs text-ink/45">Balance due on invoice</span><span className={`font-semibold ${Number(receipt.balanceDueOnInvoice) > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(receipt.balanceDueOnInvoice)}</span></div>
              </div>
            </div>
          </div>

          {/* Send logs */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Send logs</h2>
              <p className="mt-0.5 text-xs text-ink/40">Every WhatsApp/email resend attempt with delivery status.</p>
            </div>
            <div className="p-4">
              {logsLoading ? (
                <Loading label="Loading logs..." />
              ) : logs.length === 0 ? (
                <EmptyState title="No send attempts yet" hint="Resend this receipt on WhatsApp or email to log the delivery." />
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log._id} className="rounded-xl border border-base bg-base/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${LOG_BADGE[log.status] || LOG_BADGE.failed}`}>{log.status}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-ink/50">{log.channel}</span>
                          {log.deliveryStatus && (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize ${DELIVERY_BADGE[log.deliveryStatus] || DELIVERY_BADGE.pending}`}>{log.deliveryStatus}</span>
                          )}
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
                        <span>To: <span className="text-ink/70">{log.clientName}{log.email && ` (${log.email})`}</span></span>
                        <span>Sent by: <span className="text-ink/70">{log.sentByName}</span></span>
                        {log.error && <span className="text-red-600">Error: {log.error}</span>}
                        <span className="text-ink/40">{fullDateTime(log.createdAt)}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {log.waUrl && (
                          <a href={log.waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-base bg-white px-2 py-1 text-[11px] font-medium text-[#128C4B] hover:border-emerald-300">
                            <FaWhatsapp className="h-2.5 w-2.5" /> Open wa.me link
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

      <ReceiptPreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        receipt={receipt}
        channel={sendChannel}
        onSend={handleSend}
        sending={sending}
        title="Resend receipt"
      />

      {/* Regenerate modal */}
      <Modal open={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerate receipt" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRegenerateOpen(false)}>Cancel</Button>
          <Button onClick={handleRegenerate} loading={regenerating}>
            <FaRedoAlt className="h-3 w-3" /> Regenerate
          </Button>
        </>}>
        <p className="text-ink/70">
          Re-fetch the linked invoice and recompute the cumulative payment figures, then regenerate the PDF for{" "}
          <span className="font-semibold">{receipt.receiptNumber}</span>. The receipt number stays the same.
        </p>
      </Modal>
    </div>
  );
}
