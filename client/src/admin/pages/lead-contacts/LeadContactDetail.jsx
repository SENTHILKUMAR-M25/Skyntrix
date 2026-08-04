import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft, FaEdit, FaTrash, FaWhatsapp, FaStickyNote, FaBuilding, FaPhoneAlt,
  FaCalendarCheck, FaUserCheck, FaClipboardList, FaCopy, FaExternalLinkAlt,
  FaPaperPlane, FaEnvelope,
} from "react-icons/fa";
import { adminGet, adminPost, adminPut, adminDelete } from "../../api";
import { useAuth } from "../../AuthContext";
import { useToast } from "../../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from "../../components/Ui";
import WhatsAppPreviewModal from "../../components/lead-contacts/WhatsAppPreviewModal";
import LeadContactTimeline from "../../components/lead-contacts/LeadContactTimeline";
import { FOLLOW_UP_OPTIONS, formatMobileNumber, fullDateTime } from "../../utils/leadContact";

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

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

export default function LeadContactDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAuth();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState("none");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  const isManager = ["super-admin", "admin"].includes(admin?.role);
  const canDelete = isManager || !!admin?.permissions?.delete;

  const fetchLead = useCallback(async () => {
    try {
      const res = await adminGet(`/lead-contacts/${id}`);
      setLead(res.data);
      setFollowUpStatus(res.data.followUpStatus || "none");
      setNextFollowUpAt(res.data.nextFollowUpAt ? new Date(res.data.nextFollowUpAt).toISOString().slice(0, 10) : "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminGet(`/lead-contacts/${id}/history?limit=50`);
      setEntries(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchLead(); }, [fetchLead]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Auto-open the send modal when navigated with ?send=1
  useEffect(() => {
    if (searchParams.get("send") === "1" && lead) {
      setPreview(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, lead, setSearchParams]);

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await adminPost(`/lead-contacts/resend/${id}`);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("WhatsApp sent successfully");
      } else {
        toast.error("WhatsApp send failed");
      }
      setPreview(false);
      fetchLead();
      fetchHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminDelete(`/lead-contacts/${id}`);
      toast.ok("Lead deleted");
      navigate("/admin/lead-contacts");
    } catch (e) {
      toast.error(e.message);
      setDeleteTarget(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) { toast.error("Write a note first"); return; }
    setNoteSaving(true);
    try {
      await adminPut(`/lead-contacts/${id}`, { notes: note.trim() });
      toast.ok("Note added to timeline");
      setNote("");
      fetchLead();
      fetchHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleFollowUp = async () => {
    setNoteSaving(true);
    try {
      await adminPut(`/lead-contacts/${id}`, {
        followUpStatus,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
      });
      toast.ok("Follow-up updated");
      setFollowUpOpen(false);
      fetchLead();
      fetchHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading) return <Loading label="Loading lead..." />;
  if (!lead) return <EmptyState title="Lead not found" />;

  const infoRows = [
    { icon: FaBuilding, label: "Business", value: lead.businessName },
    { icon: FaPhoneAlt, label: "Mobile", value: formatMobileNumber(lead.mobileNumber), href: `tel:${lead.mobileNumber}` },
    { icon: FaUserCheck, label: "Assigned to", value: lead.assignedToName || "Unassigned" },
    { icon: FaCalendarCheck, label: "Next follow-up", value: lead.nextFollowUpAt ? fullDateTime(lead.nextFollowUpAt) : "—" },
    { icon: FaClipboardList, label: "Created", value: fullDateTime(lead.createdAt) },
    { icon: FaUserCheck, label: "Created by", value: lead.createdByName || "System" },
    ...(lead.sourceLead
      ? [{ icon: FaEnvelope, label: "Source", value: "Contact form inquiry", href: `/admin/leads/${lead.sourceLead}` }]
      : []),
  ];

  return (
    <div>
      <button onClick={() => navigate("/admin/lead-contacts")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to leads
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-gradient text-lg font-bold text-white">
            {(lead.businessName || "?")[0].toUpperCase()}
          </span>
          <div>
            <h1 className="heading-md text-ink">{lead.businessName}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${WA_BADGE[lead.whatsappStatus]}`}>WhatsApp: {lead.whatsappStatus}</span>
              <Badge value={lead.followUpStatus} />
              {(lead.tags || []).map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(`/admin/lead-contacts/${id}/edit`)}>
            <FaEdit /> Edit
          </Button>
          <Button onClick={() => setPreview(true)} className="bg-[#25D366] hover:bg-[#1fb959]">
            <FaWhatsapp /> {lead.whatsappStatus === "sent" ? "Send Again" : "Send WhatsApp"}
          </Button>
          {canDelete && (
            <Button variant="danger" onClick={() => setDeleteTarget(true)}>
              <FaTrash />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Profile */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Lead profile</h2>
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

            <div className="mt-4 space-y-2">
              {lead.demoLink && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-base/80 px-3 py-2 text-sm">
                  <a href={lead.demoLink} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all text-primary hover:underline">
                    <FaExternalLinkAlt className="h-3 w-3 shrink-0" /> Demo link
                  </a>
                  <button onClick={() => { copy(lead.demoLink); toast.ok("Demo link copied"); }} className="shrink-0 text-ink/30 hover:text-primary"><FaCopy /></button>
                </div>
              )}
              {lead.websiteLink && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-base/80 px-3 py-2 text-sm">
                  <a href={lead.websiteLink} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all text-primary hover:underline">
                    <FaExternalLinkAlt className="h-3 w-3 shrink-0" /> Website
                  </a>
                  <button onClick={() => { copy(lead.websiteLink); toast.ok("Website link copied"); }} className="shrink-0 text-ink/30 hover:text-primary"><FaCopy /></button>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl bg-base/80 p-3 text-sm leading-relaxed text-ink/70">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/40">Summary</span>
              {lead.summary}
            </div>
          </div>

          {/* Follow-up */}
          <div className="card p-5">
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Follow-up</h2>
            {followUpOpen ? (
              <div className="space-y-3">
                <Field label="Status">
                  <Select value={followUpStatus} onChange={(e) => setFollowUpStatus(e.target.value)} options={FOLLOW_UP_OPTIONS} placeholder={false} />
                </Field>
                <Field label="Next follow-up date">
                  <Input type="date" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleFollowUp} loading={noteSaving}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFollowUpOpen(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setFollowUpOpen(true)}>
                <FaCalendarCheck /> Update follow-up
              </Button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Add note */}
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
              <FaStickyNote className="text-primary" /> Add a note
            </h2>
            <div className="space-y-3">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note for your team (logged with your name)..." />
              <Button onClick={handleAddNote} loading={noteSaving}>
                <FaPaperPlane /> Add note
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="card overflow-hidden">
            <div className="border-b border-base p-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Activity timeline</h2>
              <p className="mt-0.5 text-xs text-ink/40">Records every create, update, WhatsApp send and note.</p>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <Loading label="Loading activity..." />
              ) : entries.length === 0 ? (
                <EmptyState title="No activity yet" hint="Changes to this lead will appear here." />
              ) : (
                <LeadContactTimeline entries={entries} />
              )}
            </div>
          </div>
        </div>
      </div>

      <WhatsAppPreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        lead={lead}
        onSend={sendNow}
        sending={sending}
      />

      <Modal open={deleteTarget} onClose={() => setDeleteTarget(false)} title="Delete lead" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this lead, its activity history and WhatsApp send logs? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
