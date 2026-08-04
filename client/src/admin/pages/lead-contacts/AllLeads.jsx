import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaEye, FaEdit, FaTrash, FaWhatsapp, FaFileCsv, FaFileExcel,
  FaExternalLinkAlt, FaCopy, FaPhoneAlt, FaFileImport, FaDownload, FaEnvelope,
} from "react-icons/fa";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import WhatsAppPreviewModal from "../../components/lead-contacts/WhatsAppPreviewModal";
import LeadContactStatCards from "../../components/lead-contacts/LeadContactStatCards";
import { LEAD_STATUS_OPTIONS, WHATSAPP_STATUS_OPTIONS, formatMobileNumber } from "../../utils/leadContact";
import { downloadCSV, downloadExcel, parseCSV, stamp } from "../../utils/exporters";

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

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "businessName:asc", label: "Business name (A-Z)" },
  { value: "businessName:desc", label: "Business name (Z-A)" },
  { value: "mobileNumber:asc", label: "Mobile number" },
];

const EXPORT_COLUMNS = [
  { label: "Business Name", value: (r) => r.businessName },
  { label: "Mobile Number", value: (r) => r.mobileNumber },
  { label: "Summary", value: (r) => r.summary },
  { label: "Demo Link", value: (r) => r.demoLink || "" },
  { label: "Website Link", value: (r) => r.websiteLink || "" },
  { label: "Status", value: (r) => r.status },
  { label: "WhatsApp Status", value: (r) => r.whatsappStatus },
  { label: "Tags", value: (r) => (r.tags || []).join(", ") },
  { label: "Created Date", value: (r) => new Date(r.createdAt).toLocaleString() },
];

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

export default function AllLeads() {
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

  const [selected, setSelected] = useState([]);
  const [previewLead, setPreviewLead] = useState(null);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(null); // "delete" | "send"
  const [busy, setBusy] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

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
      const res = await adminGet("/lead-contacts", params);
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
      const res = await adminGet("/lead-contacts/stats");
      setStats(res.data || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () => {
    if (selected.length === rows.length) setSelected([]);
    else setSelected(rows.map((r) => r._id));
  };

  const handleSend = async () => {
    if (!previewLead) return;
    setSending(true);
    try {
      const isExisting = rows.some((r) => r._id === previewLead._id);
      const res = isExisting
        ? await adminPost(`/lead-contacts/resend/${previewLead._id}`)
        : await adminPost("/lead-contacts/send-whatsapp", previewLead);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened in a new tab (Cloud API not configured)");
      } else if (data.status === "success") {
        toast.ok("WhatsApp sent successfully");
      } else {
        toast.error("WhatsApp send failed");
      }
      setPreviewLead(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminDelete(`/lead-contacts/${deleteTarget}`);
      toast.ok("Lead deleted");
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

  const runBulk = async () => {
    setBusy(true);
    try {
      if (bulkConfirm === "send") {
        const res = await adminPost("/lead-contacts/bulk-send", { ids: selected });
        toast.ok(res.message || "Bulk send completed");
        const fallback = (res.data?.results || []).find((r) => r.waUrl);
        if (fallback) window.open(fallback.waUrl, "_blank", "noopener");
      } else {
        const res = await adminPost("/lead-contacts/bulk-delete", { ids: selected });
        toast.ok(res.message || "Leads deleted");
      }
      setBulkConfirm(null);
      setSelected([]);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fetchAllForExport = async () => {
    const params = { search, status, whatsappStatus: waStatus, limit: 200, sort };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    const res = await adminGet("/lead-contacts", params);
    return res.data || [];
  };

  const exportFile = async (type) => {
    try {
      const all = await fetchAllForExport();
      const name = stamp(type === "csv" ? "leads" : "leads-excel");
      if (type === "csv") downloadCSV(all, EXPORT_COLUMNS, `${name}.csv`);
      else downloadExcel(all, EXPORT_COLUMNS, `${name}.xls`);
      toast.ok(`Exported ${all.length} lead(s)`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const downloadTemplate = () => {
    downloadCSV([], [
      { label: "businessName", value: () => "" },
      { label: "mobileNumber", value: () => "" },
      { label: "summary", value: () => "" },
      { label: "demoLink", value: () => "" },
      { label: "websiteLink", value: () => "" },
      { label: "tags", value: () => "" },
      { label: "notes", value: () => "" },
    ], "lead-contact-template.csv");
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    let parsed = [];
    try {
      parsed = parseCSV(text);
    } catch (e) {
      toast.error("Could not read the file. Please use the CSV template.");
      return;
    }
    if (!parsed.length) {
      toast.error("The file is empty or has no data rows.");
      return;
    }
    const valid = parsed.filter((r) => r.businessName && r.summary && r.mobileNumber);
    const invalid = parsed.length - valid.length;
    setImportPreview({ total: parsed.length, valid: valid.length, invalid, rows: parsed });
  };

  const runImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const res = await adminPost("/lead-contacts/import", { leads: importPreview.rows });
      toast.ok(res.message || "Import completed");
      setImportOpen(false);
      setImportPreview(null);
      fetchData();
      fetchStats();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const copyValue = (field, value) => {
    copy(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 1400);
  };

  const hasFilters = search || status !== "all" || waStatus !== "all" || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Lead Contact"
        subtitle="Manage business leads, send WhatsApp messages and track delivery."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate("/admin/leads")}>
              <FaEnvelope className="h-4 w-4" /> Contact Form Leads
            </Button>
            <Button onClick={() => navigate("/admin/lead-contacts/create")}>
              <FaWhatsapp className="h-4 w-4" /> Create Lead
            </Button>
          </div>
        }
      />

      <LeadContactStatCards stats={stats} loading={statsLoading} />

      {/* Toolbar */}
      <div className="card mb-4 mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search business, mobile, summary, tags..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="lg:w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...LEAD_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-44" value={waStatus} onChange={(e) => { setWaStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All WhatsApp" }, ...WHATSAPP_STATUS_OPTIONS]} placeholder={false} />
        <Select className="lg:w-44" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} options={SORT_OPTIONS} placeholder={false} />
        <Input type="date" className="lg:w-36" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" className="lg:w-36" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100" title="Import leads from CSV / Excel">
            <FaFileImport /> Import
          </button>
          <button onClick={() => exportFile("csv")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100" title="Export CSV">
            <FaFileCsv /> CSV
          </button>
          <button onClick={() => exportFile("excel")} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100" title="Export Excel">
            <FaFileExcel /> Excel
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-semibold text-primary">{selected.length} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setBulkConfirm("send")}>
              <FaWhatsapp className="h-3.5 w-3.5" /> Send WhatsApp
            </Button>
            {canDelete && (
              <Button size="sm" variant="danger" onClick={() => setBulkConfirm("delete")}>
                <FaTrash className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading label="Loading leads..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No leads match your filters" : "No leads yet"}
              hint={hasFilters ? "Try clearing the filters or adjusting the date range." : "Create your first lead to start sending WhatsApp messages."}
            />
          ) : (
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={toggleAll} className="h-4 w-4 rounded border-base accent-primary" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Business Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Mobile</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Summary</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Demo Link</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Website</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">WhatsApp</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Created</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-base/40">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(row._id)} onChange={() => toggleSelect(row._id)} className="h-4 w-4 rounded border-base accent-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-gradient text-xs font-bold text-white">
                          {(row.businessName || "?")[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{row.businessName}</div>
                          {(row.tags || []).length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {row.tags.slice(0, 3).map((t) => (
                                <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`tel:${row.mobileNumber}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-primary" title="Click to call">
                        <FaPhoneAlt className="h-3 w-3 text-ink/30" />
                        {formatMobileNumber(row.mobileNumber)}
                      </a>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <span className="line-clamp-2 text-ink/70" title={row.summary}>{row.summary}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.demoLink ? (
                        <span className="inline-flex items-center gap-1.5">
                          <a href={row.demoLink} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline" title={row.demoLink}>
                            {row.demoLink.replace(/^https?:\/\//, "").slice(0, 22)}
                          </a>
                          <button onClick={() => copyValue(`d-${row._id}`, row.demoLink)} className="text-ink/30 hover:text-primary" title="Copy demo link">
                            {copiedField === `d-${row._id}` ? <span className="text-[10px] text-emerald-600">copied</span> : <FaCopy className="h-3 w-3" />}
                          </button>
                        </span>
                      ) : <span className="text-ink/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.websiteLink ? (
                        <span className="inline-flex items-center gap-1.5">
                          <a href={row.websiteLink} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline" title={row.websiteLink}>
                            {row.websiteLink.replace(/^https?:\/\//, "").slice(0, 22)}
                          </a>
                          <button onClick={() => copyValue(`w-${row._id}`, row.websiteLink)} className="text-ink/30 hover:text-primary" title="Copy website link">
                            {copiedField === `w-${row._id}` ? <span className="text-[10px] text-emerald-600">copied</span> : <FaCopy className="h-3 w-3" />}
                          </button>
                        </span>
                      ) : <span className="text-ink/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[row.status] || STATUS_BADGE.draft}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${WA_BADGE[row.whatsappStatus] || WA_BADGE.pending}`}>{row.whatsappStatus}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/50">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/admin/lead-contacts/${row._id}`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View details">
                          <FaEye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => navigate(`/admin/lead-contacts/${row._id}/edit`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Edit">
                          <FaEdit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setPreviewLead(row)} className="rounded-md p-2 text-[#128C4B] hover:bg-emerald-50" title="Preview message">
                          <FaWhatsapp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => navigate(`/admin/lead-contacts/${row._id}?send=1`)} className="rounded-md p-2 text-ink/50 hover:bg-emerald-50 hover:text-emerald-700" title="Open & send">
                          <FaExternalLinkAlt className="h-3 w-3" />
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

      {/* Preview / send modal */}
      <WhatsAppPreviewModal
        open={!!previewLead}
        onClose={() => setPreviewLead(null)}
        lead={previewLead}
        onEdit={() => {
          if (previewLead?._id) navigate(`/admin/lead-contacts/${previewLead._id}/edit`);
          setPreviewLead(null);
        }}
        onSend={handleSend}
        sending={sending}
      />

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete lead" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={busy}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this lead, its activity history and WhatsApp send logs? This cannot be undone.</p>
      </Modal>

      {/* Bulk confirm modal */}
      <Modal open={!!bulkConfirm} onClose={() => setBulkConfirm(null)} title={bulkConfirm === "send" ? "Send WhatsApp to selection" : "Bulk delete leads"} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setBulkConfirm(null)}>Cancel</Button>
          <Button variant={bulkConfirm === "delete" ? "danger" : "primary"} onClick={runBulk} loading={busy}>
            {bulkConfirm === "send" ? "Send now" : "Delete"}
          </Button>
        </>}>
        {bulkConfirm === "send" ? (
          <p className="text-ink/70">
            Send the WhatsApp message to <span className="font-semibold">{selected.length} lead(s)</span>? Each gets the formatted Skyntrix intro message.
          </p>
        ) : (
          <p className="text-ink/70">
            Permanently delete <span className="font-semibold">{selected.length} lead(s)</span> and their history? This cannot be undone.
          </p>
        )}
      </Modal>

      {/* Import modal */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportPreview(null); }} title="Import leads" size="md"
        footer={
          importPreview && (
            <>
              <Button variant="ghost" onClick={() => setImportPreview(null)}>Choose another file</Button>
              <Button onClick={runImport} loading={importing}>Import {importPreview.valid} lead(s)</Button>
            </>
          )
        }>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-base/80 p-4 text-sm text-ink/70">
            <div>
              <p className="font-semibold text-ink">How it works</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-ink/60">
                <li>Download the template and fill in your leads (one per row).</li>
                <li>Required columns: <code className="rounded bg-white px-1">businessName</code>, <code className="rounded bg-white px-1">mobileNumber</code>, <code className="rounded bg-white px-1">summary</code>.</li>
                <li>Optional: <code className="rounded bg-white px-1">demoLink</code>, <code className="rounded bg-white px-1">websiteLink</code>, <code className="rounded bg-white px-1">tags</code> (comma separated), <code className="rounded bg-white px-1">notes</code>.</li>
                <li>Save from Excel as CSV, then upload it here. Invalid rows are skipped and reported.</li>
              </ul>
              <button onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/50">
                <FaDownload /> Download CSV template
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-base bg-base/40 px-4 py-8 text-center transition-colors hover:border-primary/40">
            <FaFileImport className="mb-2 h-8 w-8 text-primary/50" />
            <span className="text-sm font-semibold text-ink/70">Click to upload a CSV file</span>
            <span className="mt-1 text-xs text-ink/40">Exported from Excel (.csv) or the lead-contact template</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                handleImportFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          {importPreview && (
            <div className="rounded-xl border border-base bg-base/40 p-4 text-sm">
              <div className="mb-2 flex flex-wrap gap-3 font-semibold">
                <span className="text-ink/70">{importPreview.total} rows</span>
                <span className="text-emerald-600">{importPreview.valid} valid</span>
                <span className="text-red-600">{importPreview.invalid} will be skipped</span>
              </div>
              <p className="text-xs text-ink/45">Imported leads are saved as Draft. You can review and send WhatsApp from the table.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
