import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaPaperPlane, FaEnvelope, FaPhone, FaBuilding, FaTag, FaMoneyBill, FaFlag, FaCalendarAlt, FaClipboardList } from "react-icons/fa";
import { adminGet, adminPut, adminPost, adminDelete } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, Select, Textarea } from "../components/Ui";
import LeadTimeline from "../components/LeadTimeline";

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
];

const filterStatusOptions = [{ value: "all", label: "All statuses" }, ...statusOptions];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin: me } = useAuth();

  const [lead, setLead] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [addNote, setAddNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [editingEntry, setEditingEntry] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isManager = useMemo(() => ["super-admin", "admin"].includes(me?.role), [me]);
  const canAddNote = me?.permissions?.update || isManager;

  const fetchLead = useCallback(async () => {
    try {
      const res = await adminGet(`/leads/admin/${id}`);
      setLead(res.data);
      setNextStatus(res.data.status);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = { page, limit: 30 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await adminGet(`/leads/admin/${id}/history`, params);
      setEntries(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, page, statusFilter, fromDate, toDate, refreshKey, toast]);

  useEffect(() => { fetchLead(); }, [fetchLead]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const reloadHistory = useCallback(() => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  }, []);

  const reloadAll = useCallback(() => {
    reloadHistory();
    fetchLead();
  }, [reloadHistory, fetchLead]);

  const handleStatusUpdate = async () => {
    if (!nextStatus) { toast.error("Please choose a status"); return; }
    if (nextStatus === lead?.status && !statusNote.trim()) {
      toast.info(`Status is already ${nextStatus}. Add a note to log an entry.`);
      return;
    }
    setSavingStatus(true);
    try {
      await adminPut(`/leads/admin/${id}/status`, { status: nextStatus, note: statusNote.trim() });
      toast.ok("Status updated and logged to timeline");
      setStatusNote("");
      reloadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!addNote.trim()) { toast.error("Write a note first"); return; }
    setAddingNote(true);
    try {
      await adminPost(`/leads/admin/${id}/history`, { note: addNote.trim() });
      toast.ok("Note added");
      setAddNote("");
      reloadHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditSave = async () => {
    if (!editNote.trim()) { toast.error("Note cannot be empty"); return; }
    setSavingEdit(true);
    try {
      await adminPut(`/leads/admin/history/${editingEntry._id}`, { note: editNote.trim() });
      toast.ok("Note updated");
      setEditingEntry(null);
      fetchHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminDelete(`/leads/admin/history/${deletingEntry._id}`);
      toast.ok("Note deleted");
      setDeletingEntry(null);
      fetchHistory();
    } catch (e) {
      toast.error(e.message);
      setDeletingEntry(null);
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = useCallback(
    (entry) => isManager || String(entry.createdBy) === String(me?._id),
    [isManager, me]
  );
  const canDelete = useCallback(
    (entry) => isManager || (String(entry.createdBy) === String(me?._id) && !!me?.permissions?.delete),
    [isManager, me]
  );

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setEditNote(entry.note || "");
  };

  const infoRows = useMemo(() => {
    if (!lead) return [];
    return [
      { icon: FaEnvelope, label: "Email", value: lead.email },
      { icon: FaPhone, label: "Phone", value: lead.phone || "—" },
      { icon: FaBuilding, label: "Company", value: lead.company || "—" },
      { icon: FaTag, label: "Service", value: lead.service || "—" },
      { icon: FaMoneyBill, label: "Budget", value: lead.budget || "—" },
      { icon: FaFlag, label: "Source", value: lead.source || "—" },
      { icon: FaCalendarAlt, label: "Received", value: new Date(lead.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
    ];
  }, [lead]);

  if (loading) return <Loading label="Loading lead..." />;
  if (!lead) return <EmptyState title="Lead not found" />;

  return (
    <div>
      <button
        onClick={() => navigate("/admin/leads")}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary"
      >
        <FaArrowLeft /> Back to leads
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-gradient text-lg font-bold text-white">
            {(lead.name || "?")[0].toUpperCase()}
          </span>
          <div>
            <h1 className="heading-md text-ink">{lead.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Badge value={lead.status} />
              {lead.company && <span className="text-sm text-ink/50">{lead.company}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Lead profile */}
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
              <FaClipboardList className="text-primary" /> Lead profile
            </h2>
            <div className="space-y-3">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <row.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ink/40">{row.label}</div>
                    <div className="break-words text-sm font-medium text-ink/80">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
            {lead.message && (
              <div className="mt-4 rounded-xl bg-base/80 p-3 text-sm leading-relaxed text-ink/70">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/40">Message</span>
                {lead.message}
              </div>
            )}
          </div>

          {/* Status update */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Update status</h2>
            <div className="space-y-3">
              <Field label="Status change">
                <div className="flex items-center gap-2 rounded-lg border border-base bg-base/40 px-3 py-2 text-sm">
                  <Badge value={lead.status} />
                  <FaArrowRight className="h-3 w-3 text-ink/30" />
                  <Badge value={nextStatus || lead.status} />
                </div>
              </Field>
              <Field label="New status">
                <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} options={statusOptions} placeholder={false} />
              </Field>
              <Field label="Note (optional)" hint="Explains the reason for this change and is logged to the timeline">
                <Textarea rows={3} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. Scheduled a discovery call for Thursday" />
              </Field>
              <Button className="w-full" loading={savingStatus} onClick={handleStatusUpdate} disabled={!canAddNote}>
                {canAddNote ? "Update status" : "You don't have permission"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right column: activity */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
              <FaPaperPlane className="text-primary" /> Add a note
            </h2>
            <div className="space-y-3">
              <Textarea
                rows={2}
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="Leave an internal note about this lead (recorded with your name and current status)..."
                disabled={!canAddNote}
              />
              <Button onClick={handleAddNote} loading={addingNote} disabled={!canAddNote}>
                <FaPaperPlane /> Add note
              </Button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-base p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Activity timeline</h2>
                <p className="mt-0.5 text-xs text-ink/40">
                  {meta?.totalItems || entries.length} record{meta?.totalItems === 1 ? "" : "s"} · newest first
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select className="sm:w-36" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} options={filterStatusOptions} placeholder={false} />
                <Input type="date" className="sm:w-40" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
                <Input type="date" className="sm:w-40" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
              </div>
            </div>

            <div className="p-4">
              {historyLoading ? (
                <Loading label="Loading activity..." />
              ) : entries.length === 0 ? (
                <EmptyState title="No activity found" hint="Try clearing the filters or add a note above." />
              ) : (
                <LeadTimeline entries={entries} canEdit={canEdit} canDelete={canDelete} onEdit={openEdit} onDelete={setDeletingEntry} />
              )}
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-base px-4 py-3 text-sm">
                <span className="text-ink/50">Page {meta.page} of {meta.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={!meta.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="secondary" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit note modal */}
      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title="Edit note" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingEntry(null)}>Cancel</Button>
            <Button onClick={handleEditSave} loading={savingEdit}>Save changes</Button>
          </>
        }>
        <div className="space-y-3">
          {editingEntry && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink/40">Change:</span>
              {editingEntry.previousStatus === editingEntry.newStatus ? (
                <Badge value={editingEntry.newStatus} />
              ) : (
                <>
                  <Badge value={editingEntry.previousStatus} />
                  <FaArrowRight className="h-3 w-3 text-ink/30" />
                  <Badge value={editingEntry.newStatus} />
                </>
              )}
            </div>
          )}
          <Field label="Note">
            <Textarea rows={4} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Delete note modal */}
      <Modal open={!!deletingEntry} onClose={() => setDeletingEntry(null)} title="Delete note" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingEntry(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }>
        <p className="text-ink/70">Delete this timeline entry? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
