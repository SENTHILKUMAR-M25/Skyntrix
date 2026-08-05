import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEye, FaDownload, FaWhatsapp, FaReceipt, FaFileCirclePlus, FaEnvelope,
} from "react-icons/fa6";
import { FaSearch } from "react-icons/fa";
import { adminGet, adminPost } from "../../api";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, PageHeader, Select } from "../../components/Ui";
import ReceiptStatCards from "../../components/receipts/ReceiptStatCards";
import GenerateReceiptModal from "../../components/receipts/GenerateReceiptModal";
import ReceiptPreviewModal from "../../components/receipts/ReceiptPreviewModal";
import {
  RECEIPT_SORT_OPTIONS, formatMoney, formatDate, downloadReceiptPdf,
} from "../../utils/receipt";

export default function Receipts() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [busy, setBusy] = useState(false);

  const queryParams = useMemo(() => {
    const params = { search, sort, page, limit };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [search, sort, page, limit, fromDate, toDate]);

  const fetchData = useCallback(async (params = queryParams) => {
    setLoading(true);
    try {
      const res = await adminGet("/receipts", params);
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
      const res = await adminGet("/receipts/stats");
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
      await downloadReceiptPdf(row._id, `${row.receiptNumber || "receipt"}.pdf`);
      toast.ok("PDF downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSend = async () => {
    if (!previewTarget) return;
    setBusy(true);
    try {
      const res = await adminPost(`/receipts/${previewTarget._id}/resend`, { channel: sendChannel });
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
      setPreviewTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
      setPreviewTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = search || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Payment Receipts"
        subtitle="Generate branded payment receipts from paid invoices, resend them via WhatsApp/email and track receipt history."
        action={
          <Button onClick={() => setGenerateOpen(true)}>
            <FaFileCirclePlus className="h-4 w-4" /> Generate Receipt
          </Button>
        }
      />

      <ReceiptStatCards stats={stats} loading={statsLoading} />

      {/* Toolbar */}
      <div className="card mb-4 mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search receipt no, client, project, invoice no, UTR..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="lg:w-48" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} options={RECEIPT_SORT_OPTIONS} placeholder={false} />
        <Input type="date" className="lg:w-36" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" className="lg:w-36" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading label="Loading receipts..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No receipts match your filters" : "No receipts yet"}
              hint={hasFilters ? "Try clearing the filters or adjusting the date range." : "Mark an invoice as Paid and generate its payment receipt."}
            />
          ) : (
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Receipt</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Project</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Total Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Balance</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Paid On</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-base/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-gradient text-[10px] font-bold text-white">
                          <FaReceipt className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <div className="font-semibold text-primary">{row.receiptNumber}</div>
                          <div className="text-[11px] text-ink/45">{row.invoiceNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{row.clientName}</div>
                      {row.businessName && <div className="text-xs text-ink/45">{row.businessName}</div>}
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <span className="line-clamp-1 text-ink/70" title={row.projectName}>{row.projectName}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(row.amountReceived)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatMoney(row.totalPaidTillDate)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${Number(row.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(row.remainingBalance)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-base px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/60">{String(row.paymentMethod || "other").replace(/_/g, " ")}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(row.paidOn)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/admin/receipts/${row._id}`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View details">
                          <FaEye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDownload(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Download PDF">
                          <FaDownload className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setPreviewTarget(row); setSendChannel("whatsapp"); }} className="rounded-md p-2 text-[#128C4B] hover:bg-emerald-50" title="Send via WhatsApp">
                          <FaWhatsapp className="h-3.5 w-3.5" />
                        </button>
                        {row.email && (
                          <button onClick={() => { setPreviewTarget(row); setSendChannel("email"); }} className="rounded-md p-2 text-blue-600 hover:bg-blue-50" title="Send via email">
                            <FaEnvelope className="h-3.5 w-3.5" />
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

      <GenerateReceiptModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={(receipt) => { fetchData(); fetchStats(); if (receipt?._id) navigate(`/admin/receipts/${receipt._id}`); }}
      />

      <ReceiptPreviewModal
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        receipt={previewTarget}
        channel={sendChannel}
        onSend={handleSend}
        sending={busy}
        title="Resend receipt"
      />
    </div>
  );
}
