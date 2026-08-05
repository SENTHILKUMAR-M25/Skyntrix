import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaEdit, FaTrash, FaDownload, FaWhatsapp, FaEnvelope, FaBuilding, FaPhoneAlt,
  FaUserTie, FaProjectDiagram, FaCalendarCheck, FaFilePdf, FaCopy, FaExternalLinkAlt, FaRedoAlt,
  FaBan, FaCheckCircle, FaMoneyBillWave, FaHashtag, FaLink,
} from "react-icons/fa";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import InvoicePreviewModal from "../../components/invoices/InvoicePreviewModal";
import {
  formatMoney, formatMobileNumber, formatDate, fullDateTime, timeAgo, downloadInvoicePdf, isOverdue,
  PAYMENT_METHOD_OPTIONS, INVOICE_TYPE_OPTIONS,
} from "../../utils/invoice";

const STATUS_BADGE = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};
const PAY_BADGE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  partial: "bg-cyan-100 text-cyan-700 border-cyan-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};
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

const EMPTY_PAYMENT = { amount: "", method: "bank_transfer", reference: "", paidOn: new Date().toISOString().slice(0, 10), note: "" };

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAuth();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [project, setProject] = useState(null);

  const [preview, setPreview] = useState(false);
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [sending, setSending] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState(EMPTY_PAYMENT);
  const [savingPayment, setSavingPayment] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedLog, setCopiedLog] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await adminGet(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await adminGet(`/invoices/${id}/logs?limit=25`);
      setLogs(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [id, toast]);

  const fetchProject = useCallback(async (quotationId) => {
    if (!quotationId) {
      setProject(null);
      return;
    }
    try {
      const res = await adminGet(`/invoices/prefill/${quotationId}`);
      setProject(res.data || null);
    } catch (e) {
      setProject(null);
    }
  }, []);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchProject(invoice?.quotationId); }, [invoice?.quotationId, fetchProject]);

  const handleDownload = async () => {
    try {
      await downloadInvoicePdf(id, `${invoice.invoiceNumber}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await adminPost(`/invoices/${id}/resend`, { channel: sendChannel });
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok(data.message || `Invoice sent via ${data.channel || sendChannel}`);
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Invoice send failed");
      }
      setPreview(false);
      fetchInvoice();
      fetchLogs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleRecordPayment = async () => {
    const amount = Number(payment.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setSavingPayment(true);
    try {
      await adminPost(`/invoices/${id}/payments`, {
        amount,
        method: payment.method,
        reference: payment.reference,
        paidOn: payment.paidOn ? new Date(payment.paidOn).toISOString() : undefined,
        note: payment.note,
      });
      toast.ok("Payment recorded");
      setPaymentOpen(false);
      setPayment(EMPTY_PAYMENT);
      fetchInvoice();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleMarkPaid = async () => {
    setBusy(true);
    try {
      await adminPost(`/invoices/${id}/mark-paid`, {});
      toast.ok("Invoice marked as paid");
      fetchInvoice();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await adminPost(`/invoices/${id}/cancel`);
      toast.ok("Invoice cancelled");
      setCancelTarget(false);
      fetchInvoice();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminDelete(`/invoices/${id}`);
      toast.ok("Invoice deleted");
      navigate("/admin/invoices");
    } catch (e) {
      toast.error(e.message);
      setDeleteTarget(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/invoice/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.ok("Public invoice link copied");
    } catch {
      window.prompt("Public invoice link:", url);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  };

  if (loading) return <Loading label="Loading invoice..." />;
  if (!invoice) return <EmptyState title="Invoice not found" />;

  const isCancelled = invoice.status === "cancelled";
  const isPaid = invoice.paymentStatus === "paid";
  const balanceDue = Number(invoice.balanceDue) || 0;

  const infoRows = [
    { icon: FaHashtag, label: "Invoice number", value: invoice.invoiceNumber },
    { icon: FaBuilding, label: "Business", value: invoice.businessName || "—" },
    { icon: FaPhoneAlt, label: "Mobile", value: formatMobileNumber(invoice.mobile), href: `tel:${invoice.mobile}` },
    { icon: FaEnvelope, label: "Email", value: invoice.email || "—", href: invoice.email ? `mailto:${invoice.email}` : null },
    { icon: FaProjectDiagram, label: "Project", value: invoice.projectName },
    { icon: FaCalendarCheck, label: "Invoice date", value: formatDate(invoice.invoiceDate) },
    { icon: FaCalendarCheck, label: "Due date", value: formatDate(invoice.dueDate) },
    { icon: FaUserTie, label: "Created by", value: invoice.createdByName || "System" },
    { icon: FaCalendarCheck, label: "Created", value: fullDateTime(invoice.createdAt) },
    ...(invoice.sentAt ? [{ icon: FaWhatsapp, label: "Sent at", value: fullDateTime(invoice.sentAt) }] : []),
    ...(invoice.paidAt ? [{ icon: FaCheckCircle, label: "Paid at", value: fullDateTime(invoice.paidAt) }] : []),
  ];

  return (
    <div>
      <button onClick={() => navigate("/admin/invoices")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to invoices
      </button>

      <PageHeader
        title={`Invoice ${invoice.invoiceNumber || ""}`}
        subtitle="View the invoice, track payments and WhatsApp/email delivery."
        action={
          <div className="flex flex-wrap gap-2">
            {!isCancelled && (
              <Button variant="secondary" onClick={() => navigate(`/admin/invoices/${id}/edit`)}>
                <FaEdit /> Edit
              </Button>
            )}
            <Button variant="secondary" onClick={handleDownload}>
              <FaDownload /> Download PDF
            </Button>
            {!isCancelled && (
              <Button variant="secondary" onClick={handleCopyLink}>
                <FaLink /> {copiedLink ? "Copied!" : "Copy Link"}
              </Button>
            )}
            <Button onClick={() => { setSendChannel("whatsapp"); setPreview(true); }} className="bg-[#25D366] hover:bg-[#1fb959]">
              <FaWhatsapp /> {invoice.sentAt ? "Send Again" : "Send"}
            </Button>
            {!isCancelled && !isPaid && (
              <Button variant="secondary" onClick={() => setPaymentOpen(true)}>
                <FaMoneyBillWave /> Record Payment
              </Button>
            )}
            {!isCancelled && !isPaid && (
              <Button variant="secondary" onClick={handleMarkPaid} loading={busy}>
                <FaCheckCircle /> Mark Paid
              </Button>
            )}
            {!isCancelled && (
              <Button variant="secondary" onClick={() => setCancelTarget(true)} className="text-red-600 hover:border-red-300 hover:bg-red-50">
                <FaBan /> Cancel
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDeleteTarget(true)}>
                <FaTrash />
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[invoice.status] || STATUS_BADGE.draft}`}>{invoice.status}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PAY_BADGE[invoice.paymentStatus] || PAY_BADGE.pending}`}>Payment: {invoice.paymentStatus}</span>
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase text-ink/60">{invoice.type}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">Total: <span className="text-primary">{formatMoney(invoice.totalAmount)}</span></span>
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isOverdue(invoice) ? "text-red-600" : "text-ink/60"}`}>Balance: {formatMoney(invoice.balanceDue)}</span>
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

          {invoice.pdfUrl && (
            <div className="card p-5">
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">PDF</h2>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-base/80 px-3 py-2 text-sm">
                <a href={`${invoice.pdfUrl}?v=${encodeURIComponent(invoice.updatedAt || Date.now())}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 break-all text-primary hover:underline">
                  <FaFilePdf className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate">{invoice.pdfUrl.split("/").pop()}</span>
                </a>
                <button onClick={handleDownload} className="shrink-0 text-ink/30 hover:text-primary" title="Download PDF"><FaDownload /></button>
              </div>
            </div>
          )}

          {Number(invoice.projectTotal) > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Project payment</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink/50">Project Total</span><span className="font-semibold text-ink">{formatMoney(invoice.projectTotal)}</span></div>
                <div className="flex justify-between"><span className="text-ink/50">Previous Payments</span><span className="font-semibold text-ink">{formatMoney(invoice.previousPaid)}</span></div>
                <div className="flex justify-between"><span className="text-ink/50">Current Invoice Amount</span><span className="font-semibold text-primary">{formatMoney(invoice.totalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-ink/50">Total Paid Till Date</span><span className="font-semibold text-emerald-600">{formatMoney(invoice.totalPaidTillDate)}</span></div>
                <div className="flex justify-between"><span className="text-ink/50">Outstanding Balance</span>
                  <span className={`font-bold ${Number(invoice.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(invoice.remainingBalance)}</span>
                </div>
                <div className="flex justify-between items-center"><span className="text-ink/50">Payment Status</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${PAY_BADGE[invoice.paymentStatus] || PAY_BADGE.pending}`}>{invoice.paymentStatus}</span>
                </div>
              </div>
            </div>
          )}

          {project && Number(project.summary?.projectTotal) > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-base p-4">
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment timeline</h2>
                <p className="mt-0.5 text-xs text-ink/40">All invoices from quotation approval to final settlement.</p>
              </div>
              <div className="divide-y divide-base">
                {!project.existing?.length ? (
                  <div className="p-4"><EmptyState title="No invoices yet" hint="Invoices will appear once raised for this quotation." /></div>
                ) : project.existing.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/admin/invoices/${inv._id}`)}
                        className={`font-semibold ${String(inv._id) === String(id) ? "text-primary" : "text-ink hover:text-primary"}`}
                      >
                        {inv.invoiceNumber}
                      </button>
                      <div className="text-[11px] capitalize text-ink/45">{inv.type} · {formatDate(inv.sentAt || inv.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-ink/60">Amount {formatMoney(inv.totalAmount)}</span>
                      <span className="font-medium text-emerald-600">Paid {formatMoney(inv.amountPaid)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${PAY_BADGE[inv.paymentStatus] || PAY_BADGE.pending}`}>
                        {inv.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink/50">Subtotal</span><span className="font-semibold text-ink">{formatMoney(invoice.subtotal)}</span></div>
              {Number(invoice.discountAmount) > 0 && (
                <div className="flex justify-between"><span className="text-ink/50">Discount</span><span className="font-semibold text-red-600">- {formatMoney(invoice.discountAmount)}</span></div>
              )}
              {Number(invoice.taxAmount) > 0 && (
                <div className="flex justify-between"><span className="text-ink/50">GST ({Number(invoice.taxRate) || 0}%)</span><span className="font-semibold text-ink">{formatMoney(invoice.taxAmount)}</span></div>
              )}
              <div className="flex justify-between border-t border-base pt-1"><span className="font-semibold text-ink">Total</span><span className="font-bold text-primary">{formatMoney(invoice.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink/50">Amount paid</span><span className="font-semibold text-emerald-600">{formatMoney(invoice.amountPaid)}</span></div>
              <div className="flex justify-between"><span className="text-ink/50">Balance due</span><span className={`font-semibold ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(invoice.balanceDue)}</span></div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Line items</h2>
            </div>
            {!invoice.items?.length ? (
              <EmptyState title="No line items" hint="This invoice has no itemised billing." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-base text-sm">
                  <thead className="bg-base/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">Item</th>
                      <th className="px-4 py-3 text-left font-semibold text-ink/60">Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-ink/60">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-ink/60">Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-ink/60">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base">
                    {invoice.items.map((item, i) => (
                      <tr key={i} className="transition-colors hover:bg-base/40">
                        <td className="px-4 py-3 text-ink/40">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{item.name}</td>
                        <td className="max-w-[260px] px-4 py-3 text-ink/60">{item.description || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">{item.quantity}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">{formatMoney(item.unitPrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">{formatMoney(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-primary/5">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-bold text-ink">GRAND TOTAL</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-primary">{formatMoney(invoice.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Payments ledger */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-base p-4">
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment ledger</h2>
                <p className="mt-0.5 text-xs text-ink/40">Every payment recorded against this invoice.</p>
              </div>
              {!isCancelled && !isPaid && (
                <Button size="sm" variant="secondary" onClick={() => setPaymentOpen(true)}>
                  <FaMoneyBillWave className="h-3 w-3" /> Record
                </Button>
              )}
            </div>
            <div className="p-4">
              {!invoice.payments?.length ? (
                <EmptyState title="No payments recorded" hint="Record a payment to update the balance." />
              ) : (
                <div className="space-y-3">
                  {invoice.payments.map((p) => (
                    <div key={p._id} className="rounded-xl border border-base bg-base/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-emerald-600">+ {formatMoney(p.amount)}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-ink/50">{String(p.method || "other").replace(/_/g, " ")}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/45">
                        <span>Paid on: <span className="text-ink/70">{formatDate(p.paidOn)}</span></span>
                        {p.reference && <span>Reference: <span className="text-ink/70">{p.reference}</span></span>}
                        {p.note && <span>Note: <span className="text-ink/70">{p.note}</span></span>}
                        <span>By: <span className="text-ink/70">{p.receivedByName || "System"}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes / terms */}
          {invoice.notes && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Terms</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{invoice.terms}</p>
            </div>
          )}

          {/* Send logs */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Send logs</h2>
              <p className="mt-0.5 text-xs text-ink/40">Every WhatsApp/email send attempt with delivery status.</p>
            </div>
            <div className="p-4">
              {logsLoading ? (
                <Loading label="Loading logs..." />
              ) : logs.length === 0 ? (
                <EmptyState title="No send attempts yet" hint="Send this invoice on WhatsApp or email to log the delivery." />
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
                          {log.isReminder && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">reminder</span>}
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
                        <span>To: <span className="text-ink/70">{log.clientName}{log.email && ` (${log.email})`}</span></span>
                        <span>Sent by: <span className="text-ink/70">{log.sentByName}</span></span>
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

      <InvoicePreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        invoice={invoice}
        channel={sendChannel}
        onSend={handleSend}
        sending={sending}
        title={invoice.sentAt ? "Resend invoice" : "Send invoice"}
      />

      {/* Record payment modal */}
      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record payment" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment} loading={savingPayment}>
            <FaMoneyBillWave className="h-3 w-3" /> Save payment
          </Button>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (Rs.)" required hint={`Balance due: ${formatMoney(balanceDue)}`}>
            <Input type="number" min="0" step="0.01" placeholder="0" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
          </Field>
          <Field label="Method">
            <Select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} options={PAYMENT_METHOD_OPTIONS} placeholder={false} />
          </Field>
          <Field label="Reference">
            <Input placeholder="UTR / transaction id" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
          </Field>
          <Field label="Paid on">
            <Input type="date" value={payment.paidOn} onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <Input placeholder="Optional note" value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={cancelTarget} onClose={() => setCancelTarget(false)} title="Cancel invoice" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setCancelTarget(false)}>Keep</Button>
          <Button variant="danger" onClick={handleCancel} loading={busy}>Cancel invoice</Button>
        </>}>
        <p className="text-ink/70">
          Cancel <span className="font-semibold">{invoice.invoiceNumber}</span>? The invoice stays in the list but is marked as cancelled.
        </p>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteTarget} onClose={() => setDeleteTarget(false)} title="Delete invoice" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={busy}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this invoice, its PDF and send logs? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
