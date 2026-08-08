import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaEye, FaEdit, FaTrash, FaPlus, FaFileInvoiceDollar, FaWhatsapp, FaBuilding,
} from "react-icons/fa";
import { FaFileCirclePlus } from "react-icons/fa6";
import { adminGet, adminPost, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import RequirementStatCards from "../../components/requirements/RequirementStatCards";
import RequirementFormModal from "../../components/requirements/RequirementFormModal";
import {
  REQUIREMENT_STATUS, REQUIREMENT_STATUS_BADGE, REQUIREMENT_PRIORITIES, PROJECT_TYPES,
  formatMobileNumber, formatDate, requirementSummary, requirementEstimate,
} from "../../utils/requirement";

const STATUS_OPTIONS = [{ value: "all", label: "All statuses" }, ...REQUIREMENT_STATUS];
const PRIORITY_OPTIONS = [{ value: "all", label: "All priorities" }, ...REQUIREMENT_PRIORITIES];
const TYPE_OPTIONS = [{ value: "all", label: "All project types" }, ...PROJECT_TYPES.map((t) => ({ value: t, label: t }))];
const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "createdAt:desc", label: "Recently created" },
  { value: "businessName:asc", label: "Business (A-Z)" },
  { value: "clientName:asc", label: "Client (A-Z)" },
  { value: "clientBudget:desc", label: "Client budget (high)" },
  { value: "estimatedDevelopmentCost:desc", label: "Est. cost (high)" },
];

function ContactPicker({ open, onClose, onSelect }) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet("/lead-contacts", { search, page, limit: 10 });
      setContacts(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    fetchContacts();
  }, [open, fetchContacts]);

  return (
    <Modal open={open} onClose={onClose} title="Select a contact to collect requirements from" size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="relative mb-4">
        <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
        <Input className="pl-9" placeholder="Search by business, person or mobile..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <div className="space-y-2">
        {loading ? (
          <Loading label="Loading contacts..." />
        ) : contacts.length === 0 ? (
          <EmptyState title="No contacts found" hint="Create a lead contact first, then collect its requirement." />
        ) : (
          contacts.map((c) => (
            <button
              key={c._id}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 rounded-xl border border-base bg-base/30 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-gradient text-white">
                <FaBuilding className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{c.businessName || "Unnamed business"}</span>
                <span className="block text-xs text-ink/50">{c.contactPerson || "—"} · {formatMobileNumber(c.mobileNumber)}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary">Select →</span>
            </button>
          ))
        )}
      </div>
      {page > 1 && (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)}>Load previous</Button>
        </div>
      )}
    </Modal>
  );
}

export default function Requirements() {
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
  const [priority, setPriority] = useState("all");
  const [projectType, setProjectType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [formState, setFormState] = useState(null); // { contact, requirement } for the modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const queryParams = useMemo(() => {
    const params = { search, status, priority, projectType, sort, page, limit };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [search, status, priority, projectType, sort, page, limit, fromDate, toDate]);

  const fetchData = useCallback(async (params = queryParams) => {
    setLoading(true);
    try {
      const res = await adminGet("/requirements", params);
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
      const res = await adminGet("/requirements/stats");
      setStats(res.data || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openCreate = (contact) => {
    setPickerOpen(false);
    setFormState({ contact, requirement: null });
  };

  const openEdit = (req) => {
    setFormState({ contact: null, requirement: req });
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminDelete(`/requirements/${deleteTarget}`);
      toast.ok("Requirement deleted");
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

  const handleMoveToQuotation = async () => {
    if (!quoteTarget) return;
    setBusy(true);
    try {
      await adminPost(`/requirements/${quoteTarget._id}/status`, { status: "ready_for_quotation" });
      toast.ok("Requirement marked ready - building quotation");
      setQuoteTarget(null);
      navigate(`/admin/quotations/create?requirementId=${quoteTarget._id}`);
    } catch (e) {
      toast.error(e.message);
      setQuoteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = search || status !== "all" || priority !== "all" || projectType !== "all" || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Requirements"
        subtitle="Collect detailed project requirements from contacts and hand them to quotations."
        action={
          <Button onClick={() => setPickerOpen(true)}>
            <FaFileCirclePlus className="h-4 w-4" /> New Requirement
          </Button>
        }
      />

      <RequirementStatCards stats={stats} loading={statsLoading} />

      {/* Toolbar */}
      <div className="card mb-4 mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search business, client, project, mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="lg:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} placeholder={false} />
        <Select className="lg:w-36" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} options={PRIORITY_OPTIONS} placeholder={false} />
        <Select className="lg:w-44" value={projectType} onChange={(e) => { setProjectType(e.target.value); setPage(1); }} options={TYPE_OPTIONS} placeholder={false} />
        <Select className="lg:w-48" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} options={SORT_OPTIONS} placeholder={false} />
        <Input type="date" className="lg:w-32" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" className="lg:w-32" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading label="Loading requirements..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No requirements match your filters" : "No requirements yet"}
              hint={hasFilters ? "Try clearing the filters." : "Collect your first requirement from a contact."}
            />
          ) : (
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Business</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Project</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Mobile</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Client Budget</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Estimate</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Priority</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-base/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{row.businessName}</div>
                      {row.clientName && <div className="text-xs text-ink/45">{row.clientName}</div>}
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <div className="truncate font-medium text-ink" title={row.projectName}>{row.projectName || "—"}</div>
                      {row.projectType && <div className="text-xs text-ink/45">{row.projectType}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">{formatMobileNumber(row.mobileNumber)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">{row.clientBudget ? `Rs. ${Number(row.clientBudget).toLocaleString("en-IN")}` : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-primary">
                      {requirementEstimate(row) ? `Rs. ${requirementEstimate(row).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-ink/70">{row.priority || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${REQUIREMENT_STATUS_BADGE[row.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {String(row.status || "draft").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/50">{formatDate(row.updatedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View / edit">
                          <FaEye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setQuoteTarget(row)}
                          disabled={row.status === "ready_for_quotation"}
                          className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                          title="Move to quotation"
                        >
                          <FaFileInvoiceDollar className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Edit">
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

      <ContactPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={openCreate} />

      {formState && (
        <RequirementFormModal
          open={true}
          onClose={() => setFormState(null)}
          contact={formState.contact}
          requirement={formState.requirement}
          onSaved={() => { setFormState(null); fetchData(); fetchStats(); }}
        />
      )}

      {/* Move to quotation confirm */}
      <Modal open={!!quoteTarget} onClose={() => setQuoteTarget(null)} title="Move requirement to quotation" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setQuoteTarget(null)}>Cancel</Button>
          <Button onClick={handleMoveToQuotation} loading={busy}><FaWhatsapp className="h-3.5 w-3.5" /> Continue to Quotation</Button>
        </>}>
        <p className="text-ink/70">
          Mark <span className="font-semibold">{requirementSummary(quoteTarget)}</span> as <span className="font-semibold">ready for quotation</span> and open the quotation builder with the details pre-filled?
        </p>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete requirement" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={busy}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this requirement? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
