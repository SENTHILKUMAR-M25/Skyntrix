import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaEye, FaTrash, FaDownload, FaWhatsapp, FaEnvelope, FaFileInvoice, FaFileAlt, FaCheckCircle,
} from "react-icons/fa";
import { FaReceipt } from "react-icons/fa6";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import InvoiceStatCards from "../../components/invoices/InvoiceStatCards";
import GenerateReceiptModal from "../../components/receipts/GenerateReceiptModal";
import {
  INVOICE_STATUS_OPTIONS, INVOICE_PAYMENT_STATUS_OPTIONS, INVOICE_TYPE_OPTIONS, INVOICE_SORT_OPTIONS,
  formatMoney, formatMobileNumber, formatDate, downloadInvoicePdf, isOverdue,
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

export default function Invoices() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { admin } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [type, setType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendTarget, setSendTarget] = useState(null);
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const queryParams = useMemo(() => {
    const params = { search, status, paymentStatus, type, sort, page, limit };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [search, status, paymentStatus, type, sort, page, limit, fromDate, toDate]);

  const fetchData = useCallback(async (params = queryParams) => {
    setLoading(true);
    try {
      const res = await adminGet("/invoices", params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [queryParams, toast]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await adminGet("/invoices/stats");
      setStats(res.data || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDownload = async (row) => {
    try {
      await downloadInvoicePdf(row._id, `${row.invoiceNumber || "invoice"}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSend = async () => {
    if (!sendTarget) return;
    setBusy(true);
    try {
      const res = await adminPost(`/invoices/${sendTarget._id}/resend`, { channel: sendChannel });
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok(`Invoice sent via ${data.channel || sendChannel}`);
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Invoice send failed");
      }
      setSendTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
      setSendTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminDelete(`/invoices/${deleteTarget}`);
      toast.ok("Invoice deleted");
      setDeleteTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (row) => {
    setBusy(true);
    try {
      await adminPost(`/invoices/${row._id}/mark-paid`, {});
      toast.ok(`${row.invoiceNumber} marked as paid`);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = search || status !== "all" || paymentStatus !== "all" || type !== "all" || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Generate branded invoices from approved quotations, track payments and send reminders."
        action={
          <Button onClick={() => navigate("/admin/invoices/create")}>
            <FaFileInvoice className="h-4 w-4" /> New Invoice
          </Button>
        }
      />

      <InvoiceStatCards stats={stats} loading={statsLoading} />

      {/* Toolbar */}
      <div className="card mb-4 mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search client, project, mobile, invoice no..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="lg:w-32" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All status" }, ...INVOICE_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-36" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All payment" }, ...INVOICE_PAYMENT_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-32" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} options={[{ value: "all", label: "All types" }, ...INVOICE_TYPE_OPTIONS]} placeholder={false} />
        <Select className="lg:w-48" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} options={INVOICE_SORT_OPTIONS} placeholder={false} />
        <Input type="date" className="lg:w-36" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" className="lg:w-36" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading label="Loading invoices..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No invoices match your filters" : "No invoices yet"}
              hint={hasFilters ? "Try clearing the filters or adjusting the date range." : "Create an invoice from an approved quotation or as a blank invoice."}
            />
          ) : (
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Project</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Balance</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Due</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-base/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-gradient text-[10px] font-bold text-white">
                          <FaFileAlt className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-semibold text-primary">{row.invoiceNumber}</span>
                        <span className="rounded bg-base px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">{row.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{row.clientName}</div>
                      {row.businessName && <div className="text-xs text-ink/45">{row.businessName}</div>}
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <span className="line-clamp-1 text-ink/70" title={row.projectName}>{row.projectName}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatMoney(row.totalAmount)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${Number(row.balanceDue) > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(row.balanceDue)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[row.status] || STATUS_BADGE.draft}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PAY_BADGE[row.paymentStatus] || PAY_BADGE.pending}`}>{row.paymentStatus}</span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isOverdue(row) ? "font-semibold text-red-600" : "text-ink/50"}`}>{formatDate(row.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/admin/invoices/${row._id}`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View details">
                          <FaEye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDownload(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Download PDF">
                          <FaDownload className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setSendTarget(row); setSendChannel("whatsapp"); }} className="rounded-md p-2 text-[#128C4B] hover:bg-emerald-50" title="Send / resend">
                          <FaWhatsapp className="h-3.5 w-3.5" />
                        </button>
                        {row.status !== "paid" && row.status !== "cancelled" && (
                          <button onClick={() => handleMarkPaid(row)} className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50" title="Mark as paid">
                            <FaCheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {row.status === "paid" && (
                          <button onClick={() => setReceiptTarget(row)} className="rounded-md p-2 text-primary hover:bg-primary/10" title="Generate receipt">
                            <FaReceipt className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(row._id)} className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-red-600" title="Delete">
                            <FaTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-base px-4 py-3 text-sm">
            <span className="text-ink/50">Page {meta.page} of {meta.totalPages} · {meta.totalItems} total</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={!meta.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Send confirm modal */}
      <Modal open={!!sendTarget} onClose={() => setSendTarget(null)} title="Send invoice" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setSendTarget(null)}>Cancel</Button>
          <Button onClick={handleSend} loading={busy} className={sendChannel === "email" ? "" : "bg-[#25D366] hover:bg-[#1fb959]"}>
            {sendChannel === "email" ? <FaEnvelope /> : <FaWhatsapp />} Send now
          </Button>
        </>}>
        <p className="text-ink/70 mb-3">
          Regenerate the PDF and send <span className="font-semibold">{sendTarget?.invoiceNumber}</span> to{" "}
          <span className="font-semibold">{sendTarget?.clientName}</span>.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Channel</span>
          <Select value={sendChannel} onChange={(e) => setSendChannel(e.target.value)} options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
            { value: "both", label: "WhatsApp + Email" },
          ]} />
        </label>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete invoice" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={busy}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this invoice, its PDF and send logs? This cannot be undone.</p>
      </Modal>

      <GenerateReceiptModal
        open={!!receiptTarget}
        onClose={() => setReceiptTarget(null)}
        invoice={receiptTarget}
        onGenerated={() => { fetchData(); fetchStats(); setReceiptTarget(null); }}
      />
    </div>
  );
}
