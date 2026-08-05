import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaEye, FaEdit, FaTrash, FaDownload, FaWhatsapp, FaFileInvoice, FaFileAlt,
} from "react-icons/fa";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import QuotationStatCards from "../../components/quotations/QuotationStatCards";
import {
  QUOTATION_STATUS_OPTIONS, WHATSAPP_STATUS_OPTIONS, QUOTATION_SORT_OPTIONS,
  formatMoney, formatMobileNumber, formatDate, downloadQuotationPdf,
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

export default function Quotations() {
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
  const [waStatus, setWaStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resendTarget, setResendTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const queryParams = useMemo(() => {
    const params = { search, status, whatsappStatus: waStatus, sort, page, limit };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [search, status, waStatus, sort, page, limit, fromDate, toDate]);

  const fetchData = useCallback(async (params = queryParams) => {
    setLoading(true);
    try {
      const res = await adminGet("/quotations", params);
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
      const res = await adminGet("/quotations/stats");
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
      await downloadQuotationPdf(row._id, `${row.quotationNumber || "quotation"}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleResend = async () => {
    if (!resendTarget) return;
    setBusy(true);
    try {
      const res = await adminPost(`/quotations/${resendTarget._id}/resend`);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("Quotation resent on WhatsApp");
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Quotation resend failed");
      }
      setResendTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
      setResendTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminDelete(`/quotations/${deleteTarget}`);
      toast.ok("Quotation deleted");
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

  const hasFilters = search || status !== "all" || waStatus !== "all" || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Create branded quotation PDFs and send them to clients on WhatsApp."
        action={
          <Button onClick={() => navigate("/admin/quotations/create")}>
            <FaFileInvoice className="h-4 w-4" /> New Quotation
          </Button>
        }
      />

      <QuotationStatCards stats={stats} loading={statsLoading} />

      {/* Toolbar */}
      <div className="card mb-4 mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search client, business, project, mobile, number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="lg:w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...QUOTATION_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-44" value={waStatus} onChange={(e) => { setWaStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All WhatsApp" }, ...WHATSAPP_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-48" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} options={QUOTATION_SORT_OPTIONS} placeholder={false} />
        <Input type="date" className="lg:w-36" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" className="lg:w-36" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading label="Loading quotations..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No quotations match your filters" : "No quotations yet"}
              hint={hasFilters ? "Try clearing the filters or adjusting the date range." : "Create your first quotation and send it on WhatsApp."}
            />
          ) : (
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Quotation</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Mobile</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Project</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">WhatsApp</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Created</th>
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
                        <span className="font-semibold text-primary">{row.quotationNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{row.clientName}</div>
                      {row.businessName && <div className="text-xs text-ink/45">{row.businessName}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">{formatMobileNumber(row.mobile)}</td>
                    <td className="max-w-[200px] px-4 py-3">
                      <span className="line-clamp-1 text-ink/70" title={row.projectName}>{row.projectName}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatMoney(row.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[row.status] || STATUS_BADGE.draft}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${WA_BADGE[row.whatsappStatus] || WA_BADGE.pending}`}>{row.whatsappStatus}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/50">{formatDate(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/admin/quotations/${row._id}`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View details">
                          <FaEye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDownload(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Download PDF">
                          <FaDownload className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setResendTarget(row)} className="rounded-md p-2 text-[#128C4B] hover:bg-emerald-50" title="Send / resend on WhatsApp">
                          <FaWhatsapp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => navigate(`/admin/quotations/${row._id}/edit`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Edit">
                          <FaEdit className="h-3.5 w-3.5" />
                        </button>
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

      {/* Resend confirm modal */}
      <Modal open={!!resendTarget} onClose={() => setResendTarget(null)} title="Send quotation on WhatsApp" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setResendTarget(null)}>Cancel</Button>
          <Button onClick={handleResend} loading={busy} className="bg-[#25D366] hover:bg-[#1fb959]"><FaWhatsapp /> Send now</Button>
        </>}>
        <p className="text-ink/70">
          Regenerate the PDF and send <span className="font-semibold">{resendTarget?.quotationNumber}</span> to{" "}
          <span className="font-semibold">{resendTarget?.clientName}</span> ({formatMobileNumber(resendTarget?.mobile)}) on WhatsApp?
        </p>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete quotation" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={busy}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this quotation, its PDF and WhatsApp send logs? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
