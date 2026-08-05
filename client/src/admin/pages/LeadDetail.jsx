import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaArrowRight, FaPaperPlane, FaEnvelope, FaPhone, FaBuilding, FaTag, FaMoneyBill, FaFlag,
  FaCalendarAlt, FaClipboardList, FaUser, FaExclamationTriangle,
  FaPlus, FaTrash, FaUpload, FaCheckCircle, FaClock, FaExternalLinkAlt,
} from "react-icons/fa";
import { FaFileInvoiceDollar, FaFileLines } from "react-icons/fa6";
import { adminGet, adminPut, adminPost, adminDelete } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, Select, Textarea } from "../components/Ui";
import LeadTimeline from "../components/LeadTimeline";
import {
  ALL_STAGES, PRIORITIES, PRIORITY_MAP, stageMeta, progressPercent, isOverdue, formatMoney, formatDate, initials,
} from "../utils/pipeline";
import { cn } from "../../lib/utils";

const filterStatusOptions = [{ value: "all", label: "All activities" }, ...ALL_STAGES.map((s) => ({ value: s.value, label: s.label }))];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin: me } = useAuth();

  const [overview, setOverview] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [admins, setAdmins] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [nextStage, setNextStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  const [addNote, setAddNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [editingEntry, setEditingEntry] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [reminderForm, setReminderForm] = useState({ title: "", note: "", dueAt: "" });
  const [addingReminder, setAddingReminder] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState(null);
  const [savingOpportunity, setSavingOpportunity] = useState(false);

  const fileInputRef = useRef(null);

  const isManager = useMemo(() => ["super-admin", "admin"].includes(me?.role), [me]);
  const canAddNote = me?.permissions?.update || isManager;
  const canDelete = me?.permissions?.delete || isManager;

  const lead = overview?.lead;

  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminGet(`/leads/admin/${id}/overview`);
      setOverview(res.data);
      setNextStage((s) => s || res.data?.lead?.status);
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
  }, [id, page, statusFilter, fromDate, toDate, toast]);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await adminGet("/auth/admins");
      setAdmins((res.data || []).filter((a) => a.isActive !== false));
    } catch (_) {}
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const reloadAll = useCallback(() => {
    setPage(1);
    fetchOverview();
    fetchHistory();
  }, [fetchOverview, fetchHistory]);

  const handleStageUpdate = async () => {
    if (!nextStage) { toast.error("Please choose a stage"); return; }
    if (nextStage === lead?.status && !stageNote.trim()) {
      toast.info(`Lead is already in ${stageMeta(nextStage).label}. Add a note to log an entry.`);
      return;
    }
    setSavingStage(true);
    try {
      await adminPut(`/leads/admin/${id}/status`, { status: nextStage, note: stageNote.trim() });
      toast.ok("Stage updated and logged to timeline");
      setStageNote("");
      reloadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingStage(false);
    }
  };

  const saveOpportunity = async () => {
    if (!lead) return;
    setSavingOpportunity(true);
    try {
      const assigned = admins.find((a) => String(a._id) === String(lead.assignedTo));
      await adminPut(`/leads/admin/${id}`, {
        priority: lead.priority,
        assignedTo: lead.assignedTo || null,
        assignedToName: assigned?.name || lead.assignedToName,
        dueDate: lead.dueDate ? new Date(lead.dueDate).toISOString() : null,
        dealValue: Number(lead.dealValue) || 0,
        probability: Number(lead.probability) || 0,
        closeReason: lead.status === "closed" ? lead.closeReason : undefined,
      });
      toast.ok("Opportunity details saved");
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingOpportunity(false);
    }
  };

  const handleAddNote = async () => {
    if (!addNote.trim()) { toast.error("Write a note first"); return; }
    setAddingNote(true);
    try {
      await adminPost(`/leads/admin/${id}/history`, { note: addNote.trim() });
      toast.ok("Note added");
      setAddNote("");
      fetchHistory();
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

  const addReminder = async () => {
    if (!reminderForm.title.trim()) { toast.error("Reminder title is required"); return; }
    setAddingReminder(true);
    try {
      await adminPost(`/leads/admin/${id}/reminders`, reminderForm);
      toast.ok("Reminder added");
      setReminderForm({ title: "", note: "", dueAt: "" });
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingReminder(false);
    }
  };

  const toggleReminder = async (reminder) => {
    try {
      await adminPut(`/leads/admin/${id}/reminders/${reminder._id}`, { completed: !reminder.completed });
      toast.ok(reminder.completed ? "Reminder reopened" : "Reminder completed");
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!reminderToDelete) return;
    try {
      await adminDelete(`/leads/admin/${id}/reminders/${reminderToDelete._id}`);
      toast.ok("Reminder deleted");
      setReminderToDelete(null);
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
      setReminderToDelete(null);
    }
  };

  const confirmAttachmentUpload = async () => {
    if (!uploadFile) { toast.error("Choose a file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("stage", lead?.status || "");
      const res = await adminPost(`/leads/admin/${id}/attachments`, fd);
      toast.ok(`Uploaded ${res.data?.name || "attachment"}`);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    try {
      await adminDelete(`/leads/admin/${id}/attachments/${attachmentToDelete._id}`);
      toast.ok("Attachment deleted");
      setAttachmentToDelete(null);
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
      setAttachmentToDelete(null);
    }
  };

  const approveQuotation = async (quotation) => {
    try {
      await adminPost(`/quotations/${quotation._id}/approve`, {});
      toast.ok(`Quotation ${quotation.quotationNumber} approved`);
      fetchOverview();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const canEdit = useCallback(
    (entry) => isManager || String(entry.createdBy) === String(me?._id),
    [isManager, me]
  );
  const canDeleteEntry = useCallback(
    (entry) => isManager || (String(entry.createdBy) === String(me?._id) && !!me?.permissions?.delete),
    [isManager, me]
  );

  if (loading) return <Loading label="Loading lead profile..." />;
  if (!lead) return <EmptyState title="Lead not found" />;

  const metaInfo = stageMeta(lead.status);
  const priority = PRIORITY_MAP[lead.priority] || PRIORITY_MAP.medium;
  const overdue = isOverdue(lead.dueDate);
  const assigneeOptions = [{ value: "", label: "Unassigned" }, ...admins.map((a) => ({ value: a._id, label: a.name }))];

  const infoRows = [
    { icon: FaEnvelope, label: "Email", value: lead.email },
    { icon: FaPhone, label: "Phone", value: lead.phone || "—" },
    { icon: FaBuilding, label: "Company", value: lead.company || "—" },
    { icon: FaTag, label: "Service", value: lead.service || "—" },
    { icon: FaMoneyBill, label: "Budget", value: lead.budget || "—" },
    { icon: FaFlag, label: "Source", value: lead.source || "—" },
    { icon: FaUser, label: "Assigned to", value: lead.assignedToName || "—" },
    { icon: FaCalendarAlt, label: "Received", value: new Date(lead.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
  ];

  const summary = overview?.summary || {};

  return (
    <div>
      <button
        onClick={() => navigate("/admin/pipeline")}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary"
      >
        <FaArrowLeft /> Back to pipeline
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-gradient text-lg font-bold text-white">
            {(lead.name || "?")[0].toUpperCase()}
          </span>
          <div>
            <h1 className="heading-md text-ink">{lead.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Badge value={lead.status} />
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", priority.badge)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} /> {priority.label}
              </span>
              {lead.paymentStatus && Number(lead.projectTotal) > 0 && (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                  lead.paymentStatus === "paid"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : lead.paymentStatus === "partial"
                      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                      : "border-amber-200 bg-amber-50 text-amber-700")}>
                  <FaMoneyBill className="h-3 w-3" /> {lead.paymentStatus}
                </span>
              )}
              {lead.company && <span className="text-sm text-ink/50">{lead.company}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/quotations/create?leadId=${id}`)}>
            <FaFileLines className="h-3.5 w-3.5" /> Quotation
          </Button>
          {summary.approvedQuotation && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/invoices/create?quotationId=${summary.approvedQuotation._id}`)}>
              <FaFileInvoiceDollar className="h-3.5 w-3.5" /> Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Progress strip */}
      <div className="card mb-6 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-ink/50">
            <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", metaInfo.dot)} />
            {metaInfo.label} · {metaInfo.phase} phase
          </span>
          <span className="flex items-center gap-3 text-ink/45">
            {overdue && (
              <span className="flex items-center gap-1 font-semibold text-red-600"><FaExclamationTriangle className="h-3 w-3" /> Overdue</span>
            )}
            <span className="flex items-center gap-1"><FaClock className="h-3 w-3" /> {progressPercent(lead.status)}% of pipeline</span>
            {summary.totalQuoted > 0 && <span className="font-semibold text-ink/60">Quoted {formatMoney(summary.totalQuoted)}</span>}
            {summary.amountPaid > 0 && <span className="font-semibold text-emerald-600">Paid {formatMoney(summary.amountPaid)}</span>}
            {Number(lead.remainingBalance) > 0 && <span className="font-semibold text-red-600">Remaining {formatMoney(lead.remainingBalance)}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-base">
            <div className={cn("h-full rounded-full transition-all", metaInfo.solid)} style={{ width: `${progressPercent(lead.status)}%` }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {ALL_STAGES.map((s) => (
            <span key={s.value} className={cn("h-1.5 w-1.5 rounded-full", progressPercent(lead.status) >= progressPercent(s.value) && stageIndexFor(s.value) <= stageIndexFor(lead.status) ? s.dot : "bg-base")} title={s.label} />
          ))}
          <span className="ml-1 text-[10px] text-ink/35">pipeline journey</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* ================= Left column ================= */}
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
            {(lead.tags || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>
                ))}
              </div>
            )}
            {lead.message && (
              <div className="mt-4 rounded-xl bg-base/80 p-3 text-sm leading-relaxed text-ink/70">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/40">Message</span>
                {lead.message}
              </div>
            )}
          </div>

          {/* Stage update */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Move in pipeline</h2>
            <div className="space-y-3">
              <Field label="Stage change">
                <div className="flex items-center gap-2 rounded-lg border border-base bg-base/40 px-3 py-2 text-sm">
                  <Badge value={lead.status} />
                  <FaArrowRight className="h-3 w-3 text-ink/30" />
                  <Badge value={nextStage || lead.status} />
                </div>
              </Field>
              <Field label="New stage">
                <Select value={nextStage} onChange={(e) => setNextStage(e.target.value)} options={ALL_STAGES.map((s) => ({ value: s.value, label: s.label }))} placeholder={false} />
              </Field>
              <Field label="Note (optional)" hint="Reason recorded on the timeline">
                <Textarea rows={2} value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="e.g. Client approved the budget" />
              </Field>
              <Button className="w-full" loading={savingStage} onClick={handleStageUpdate} disabled={!canAddNote}>
                {canAddNote ? "Move stage" : "You don't have permission"}
              </Button>
            </div>
          </div>

          {/* Opportunity details */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Opportunity details</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select
                    value={lead.priority}
                    onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, priority: e.target.value } }))}
                    options={PRIORITIES}
                    placeholder={false}
                  />
                </Field>
                <Field label="Assign to">
                  <Select
                    value={lead.assignedTo || ""}
                    onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, assignedTo: e.target.value || null } }))}
                    options={assigneeOptions}
                    placeholder={false}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deal value (Rs.)">
                  <Input type="number" min="0" value={lead.dealValue || ""} onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, dealValue: e.target.value } }))} />
                </Field>
                <Field label="Probability (%)">
                  <Input type="number" min="0" max="100" value={lead.probability || ""} onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, probability: e.target.value } }))} />
                </Field>
              </div>
              <Field label="Due date">
                <Input type="date" value={lead.dueDate ? new Date(lead.dueDate).toISOString().slice(0, 10) : ""} onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, dueDate: e.target.value ? new Date(e.target.value).toISOString() : null } }))} />
              </Field>
              {lead.status === "closed" && (
                <Field label="Close reason">
                  <Textarea rows={2} value={lead.closeReason || ""} onChange={(e) => setOverview((o) => ({ ...o, lead: { ...o.lead, closeReason: e.target.value } }))} />
                </Field>
              )}
              <Button className="w-full" variant="secondary" loading={savingOpportunity} onClick={saveOpportunity} disabled={!canAddNote}>
                <FaCheckCircle className="h-4 w-4" /> Save opportunity details
              </Button>
            </div>
          </div>

          {/* Reminders */}
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
              <FaClock className="text-primary" /> Reminders
            </h2>
            <div className="space-y-2">
              {(lead.reminders || []).length === 0 ? (
                <p className="rounded-lg bg-base/60 px-3 py-3 text-xs text-ink/40">No reminders yet. Set one to stay on top of follow-ups.</p>
              ) : (
                (lead.reminders || []).map((r) => {
                  const dueOverdue = !r.completed && r.dueAt && isOverdue(r.dueAt);
                  return (
                    <div key={r._id} className={cn("flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5", r.completed ? "border-base bg-base/40 opacity-70" : dueOverdue ? "border-red-200 bg-red-50/50" : "border-base bg-white")}>
                      <div className="min-w-0">
                        <div className={cn("text-sm font-medium", r.completed ? "line-through text-ink/50" : "text-ink")}>{r.title}</div>
                        {r.note && <div className="mt-0.5 text-xs text-ink/50">{r.note}</div>}
                        <div className={cn("mt-1 flex items-center gap-1 text-[11px] font-medium", dueOverdue ? "text-red-600" : "text-ink/40")}>
                          <FaCalendarAlt className="h-2.5 w-2.5" /> {r.dueAt ? formatDate(r.dueAt) : "No due date"} {dueOverdue && "· overdue"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => toggleReminder(r)}
                          className={cn("rounded-md p-1.5 transition-colors", r.completed ? "text-emerald-600 hover:bg-emerald-50" : "text-ink/40 hover:bg-emerald-50 hover:text-emerald-600")}
                          title={r.completed ? "Reopen" : "Mark complete"}
                        >
                          <FaCheckCircle className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button onClick={() => setReminderToDelete(r)} className="rounded-md p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete reminder">
                            <FaTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-base pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Title">
                  <Input placeholder="e.g. Follow up on quotation" value={reminderForm.title} onChange={(e) => setReminderForm((f) => ({ ...f, title: e.target.value }))} />
                </Field>
                <Field label="Due">
                  <Input type="date" value={reminderForm.dueAt} onChange={(e) => setReminderForm((f) => ({ ...f, dueAt: e.target.value }))} />
                </Field>
              </div>
              <Input placeholder="Note (optional)" value={reminderForm.note} onChange={(e) => setReminderForm((f) => ({ ...f, note: e.target.value }))} />
              <Button size="sm" className="w-full" variant="secondary" onClick={addReminder} loading={addingReminder} disabled={!canAddNote}>
                <FaPlus className="h-3 w-3" /> Add reminder
              </Button>
            </div>
          </div>

          {/* Attachments */}
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
              <FaPaperPlane className="text-primary" /> Attachments
            </h2>
            <div className="space-y-2">
              {(lead.attachments || []).length === 0 ? (
                <p className="rounded-lg bg-base/60 px-3 py-3 text-xs text-ink/40">No files attached yet.</p>
              ) : (
                (lead.attachments || []).map((a) => (
                  <div key={a._id} className="flex items-center justify-between gap-2 rounded-lg border border-base bg-white px-3 py-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline">
                      <FaFileLines className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.name}</span>
                      <FaExternalLinkAlt className="h-2.5 w-2.5 shrink-0 text-ink/30" />
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-ink/35">{a.size ? `${Math.round(a.size / 1024)} KB` : ""}</span>
                      {canDelete && (
                        <button onClick={() => setAttachmentToDelete(a)} className="rounded-md p-1.5 text-ink/40 hover:bg-red-50 hover:text-red-600" title="Delete attachment">
                          <FaTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-base pt-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <Button size="sm" variant="ghost" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={!canAddNote}>
                <FaUpload className="h-3 w-3" /> {uploadFile ? uploadFile.name : "Choose a file"}
              </Button>
              {uploadFile && (
                <Button size="sm" className="w-full" onClick={confirmAttachmentUpload} loading={uploading}>
                  Upload attachment
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ================= Right column ================= */}
        <div className="space-y-6">
          {/* Quotations */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-base px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
                <FaFileLines className="text-primary" /> Quotations
              </h2>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/quotations/create?leadId=${id}`)}>
                <FaPlus className="h-3 w-3" /> New quotation
              </Button>
            </div>
            {(overview?.quotations || []).length === 0 ? (
              <EmptyState title="No quotations yet" hint="Create a quotation to move this lead into the proposal phase." />
            ) : (
              <div className="divide-y divide-base">
                {overview.quotations.map((q) => (
                  <div key={q._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <button onClick={() => navigate(`/admin/quotations/${q._id}`)} className="text-sm font-semibold text-primary hover:underline">
                        {q.quotationNumber || "Quotation"}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink/45">
                        <span>{q.projectName || "—"}</span>
                        {q.approved && <span className="flex items-center gap-1 font-semibold text-emerald-600"><FaCheckCircle className="h-3 w-3" /> Approved</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-ink">{formatMoney(q.totalAmount)}</span>
                      <Badge value={q.status} />
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/quotations/${q._id}`)}>
                        <FaExternalLinkAlt className="h-3 w-3" /> View
                      </Button>
                      {!q.approved && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveQuotation(q)}>
                          <FaCheckCircle className="h-3 w-3" /> Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-base px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
                <FaFileInvoiceDollar className="text-primary" /> Invoices
              </h2>
              {summary.approvedQuotation && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/invoices/create?quotationId=${summary.approvedQuotation._id}`)}>
                  <FaPlus className="h-3 w-3" /> New invoice
                </Button>
              )}
            </div>
            {(overview?.invoices || []).length === 0 ? (
              <EmptyState title="No invoices yet" hint="Invoices appear here once you raise one from an approved quotation." />
            ) : (
              <div className="divide-y divide-base">
                {overview.invoices.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <button onClick={() => navigate(`/admin/invoices/${inv._id}`)} className="text-sm font-semibold text-primary hover:underline">
                        {inv.invoiceNumber}
                      </button>
                      <div className="mt-0.5 text-xs capitalize text-ink/45">{inv.type} invoice · {inv.projectName || ""}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right text-xs">
                        <div className="font-bold text-ink">{formatMoney(inv.totalAmount)}</div>
                        {inv.balanceDue > 0 && <div className="text-red-500">Due {formatMoney(inv.balanceDue)}</div>}
                      </div>
                      <Badge value={inv.status} />
                      <Badge value={inv.paymentStatus} />
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/invoices/${inv._id}`)}>
                        <FaExternalLinkAlt className="h-3 w-3" /> View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          {(overview?.payments || []).length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-base px-5 py-4">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
                  <FaMoneyBill className="text-primary" /> Payments received
                </h2>
                <p className="mt-0.5 text-xs text-ink/40">Paid {formatMoney(summary.amountPaid)} of {formatMoney(summary.totalQuoted)} quoted</p>
              </div>
              <div className="divide-y divide-base">
                {overview.payments.map((p) => (
                  <div key={p._id || `${p.invoiceNumber}-${p.paidOn}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <span className="font-semibold text-emerald-600">{formatMoney(p.amount)}</span>
                      <span className="ml-2 text-xs text-ink/45">{p.invoiceNumber} · {p.method.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-xs text-ink/40">{p.reference || p.note || "—"} · {new Date(p.paidOn).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-base p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
                  <FaClipboardList className="text-primary" /> Activity timeline
                </h2>
                <p className="mt-0.5 text-xs text-ink/40">{meta?.totalItems || entries.length} record{meta?.totalItems === 1 ? "" : "s"} · newest first</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select className="sm:w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} options={filterStatusOptions} placeholder={false} />
                <Input type="date" className="sm:w-36" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
                <Input type="date" className="sm:w-36" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 space-y-3">
                <Textarea
                  rows={2}
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="Add an internal note about this lead (recorded with your name and current stage)..."
                  disabled={!canAddNote}
                />
                <Button onClick={handleAddNote} loading={addingNote} disabled={!canAddNote}>
                  <FaPaperPlane /> Add note
                </Button>
              </div>

              {historyLoading ? (
                <Loading label="Loading activity..." />
              ) : entries.length === 0 ? (
                <EmptyState title="No activity found" hint="Try clearing the filters or add a note above." />
              ) : (
                <LeadTimeline entries={entries} canEdit={canEdit} canDelete={canDeleteEntry} onEdit={setEditingEntry} onDelete={setDeletingEntry} />
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
              {editingEntry.previousStatus === editingEntry.newStatus || !editingEntry.previousStatus ? (
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

      {/* Delete reminder modal */}
      <Modal open={!!reminderToDelete} onClose={() => setReminderToDelete(null)} title="Delete reminder" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReminderToDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDeleteReminder}>Delete</Button>
          </>
        }>
        <p className="text-ink/70">Delete reminder "{reminderToDelete?.title}"? This cannot be undone.</p>
      </Modal>

      {/* Delete attachment modal */}
      <Modal open={!!attachmentToDelete} onClose={() => setAttachmentToDelete(null)} title="Delete attachment" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAttachmentToDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDeleteAttachment}>Delete</Button>
          </>
        }>
        <p className="text-ink/70">Delete "{attachmentToDelete?.name}"? The stored file will also be removed.</p>
      </Modal>
    </div>
  );
}

function stageIndexFor(stage) {
  return ALL_STAGES.findIndex((s) => s.value === stage);
}
