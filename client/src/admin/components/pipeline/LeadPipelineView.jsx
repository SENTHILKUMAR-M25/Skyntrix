import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaSearch, FaBell, FaCalendarAlt, FaUser, FaArrowRight, FaTag, FaMoneyBill,
  FaExclamationTriangle, FaTasks, FaPaperPlane, FaClock, FaChevronDown,
} from "react-icons/fa";
import { FaFileInvoiceDollar } from "react-icons/fa6";
import { adminGet, adminPut } from "../../api";
import { useToast } from "../../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, Select, Textarea } from "../Ui";
import {
  PRIORITIES, PRIORITY_MAP, stageMeta, progressPercent, isOverdue, formatMoney, formatDate, initials,
} from "../../utils/pipeline";
import { cn } from "../../../lib/utils";

export default function LeadPipelineView() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ board: [], summary: { totalCount: 0, totalValue: 0, overdueCount: 0 } });

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [dragLead, setDragLead] = useState(null);
  const [hoverStage, setHoverStage] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveNote, setMoveNote] = useState("");
  const [savingMove, setSavingMove] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (priority !== "all") params.priority = priority;
      if (assignedTo !== "all") params.assignedTo = assignedTo;
      if (overdueOnly) params.overdue = "1";
      const res = await adminGet("/leads/admin/pipeline/board", params);
      setData(res.data || { board: [], summary: {} });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, priority, assignedTo, overdueOnly, toast]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await adminGet("/leads/admin/pipeline/notifications");
      setNotifications(res.data);
    } catch (e) {
      // Non-fatal: the bell just stays quiet.
    }
  }, []);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const assignees = useMemo(() => {
    const map = new Map();
    (data.board || []).forEach((col) =>
      (col.leads || []).forEach((l) => {
        if (l.assignedTo) map.set(String(l.assignedTo), l.assignedToName || "Unassigned");
      })
    );
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const notifCount = useMemo(() => {
    if (!notifications) return 0;
    return (
      (notifications.followUps?.length || 0) +
      (notifications.pendingReminders?.length || 0) +
      (notifications.overdueInvoices?.length || 0) +
      (notifications.delayedMilestones?.length || 0)
    );
  }, [notifications]);

  const openNotifications = async () => {
    await fetchNotifications();
    setNotifOpen(true);
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    setHoverStage(null);
    let parsed = null;
    try {
      parsed = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch (_) {}
    if (!parsed || !parsed.id || parsed.stage === targetStage) return;
    const lead = (data.board || []).flatMap((c) => c.leads || []).find((l) => l._id === parsed.id);
    if (!lead) return;
    setMoveTarget({ lead, toStage: targetStage });
    setMoveNote("");
  };

  const confirmMove = async () => {
    if (!moveTarget) return;
    setSavingMove(true);
    try {
      await adminPut(`/leads/admin/${moveTarget.lead._id}/status`, {
        status: moveTarget.toStage,
        note: moveNote.trim(),
      });
      toast.ok(`Moved "${moveTarget.lead.name}" to ${stageMeta(moveTarget.toStage).label}`);
      setMoveTarget(null);
      fetchBoard();
      fetchNotifications();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingMove(false);
    }
  };

  const openLead = (lead) => navigate(`/admin/leads/${lead._id}`);

  return (
    <div>
      {/* Summary + alerts */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 rounded-xl bg-white px-4 py-2 text-xs">
          <span className="text-ink/50">{data.summary.totalCount} deals</span>
          <span className="text-ink/50">{formatMoney(data.summary.totalValue)} pipeline</span>
          {data.summary.overdueCount > 0 && (
            <span className="flex items-center gap-1 font-semibold text-red-600">
              <FaExclamationTriangle className="h-3 w-3" /> {data.summary.overdueCount} overdue
            </span>
          )}
        </div>
        <button
          onClick={openNotifications}
          className="relative flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-ink/70 shadow-sm transition-colors hover:text-primary"
        >
          <FaBell className="h-4 w-4" />
          Pipeline alerts
          {notifCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-52 flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search leads, companies, services..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="sm:w-36" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: "all", label: "All priorities" }, ...PRIORITIES]} placeholder={false} />
        <Select className="sm:w-44" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} options={[{ value: "all", label: "All assignees" }, ...assignees]} placeholder={false} />
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            overdueOnly ? "border-red-300 bg-red-50 text-red-700" : "border-base bg-white text-ink/60 hover:border-red-300"
          )}
        >
          <FaClock className="h-3.5 w-3.5" /> Overdue only
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <Loading label="Loading pipeline..." />
      ) : !data.board.length ? (
        <EmptyState title="No leads found" hint="Adjust the filters, or wait for new contact-form submissions." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <AnimatePresence>
            {data.board.map((col) => {
              const meta = stageMeta(col.stage);
              return (
                <motion.div
                  key={col.stage}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "w-72 shrink-0 rounded-2xl border bg-white/70",
                    hoverStage === col.stage && dragLead ? "border-primary/60 ring-2 ring-primary/20" : "border-base"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setHoverStage(col.stage); }}
                  onDragLeave={() => setHoverStage((s) => (s === col.stage ? null : s))}
                  onDrop={(e) => handleDrop(e, col.stage)}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-base px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                      <span className="truncate text-sm font-bold text-ink">{col.label}</span>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-base px-1.5 text-[11px] font-semibold text-ink/60">
                        {col.count}
                      </span>
                    </div>
                    {col.value > 0 && <span className="shrink-0 text-[11px] font-semibold text-ink/45">{formatMoney(col.value)}</span>}
                  </div>

                  <div className="min-h-24 space-y-2.5 p-2.5">
                    {col.leads.length === 0 && !dragLead && (
                      <div className="rounded-lg border border-dashed border-base py-6 text-center text-xs text-ink/30">Drop a card here</div>
                    )}
                    {col.leads.map((lead) => {
                      const p = PRIORITY_MAP[lead.priority] || PRIORITY_MAP.medium;
                      const overdue = isOverdue(lead.dueDate);
                      return (
                        <motion.div
                          key={lead._id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", JSON.stringify({ id: lead._id, stage: lead.status }));
                            e.dataTransfer.effectAllowed = "move";
                            setDragLead(lead._id);
                          }}
                          onDragEnd={() => { setDragLead(null); setHoverStage(null); }}
                          onClick={() => openLead(lead)}
                          className={cn(
                            "group cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition-all hover:shadow-md",
                            dragLead === lead._id ? "opacity-40" : "",
                            overdue ? "border-red-200" : "border-base"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", p.dot)} title={p.label} />
                                <span className="truncate text-sm font-semibold text-ink">{lead.name}</span>
                              </div>
                              <div className="mt-0.5 truncate text-xs text-ink/45">
                                {lead.company || lead.service || "No company"}
                              </div>
                            </div>
                            {lead.dealValue > 0 && (
                              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink/60">
                                <FaMoneyBill className="h-3 w-3 text-emerald-600" /> {formatMoney(lead.dealValue)}
                              </span>
                            )}
                          </div>

                          {(lead.tags || []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {lead.tags.slice(0, 3).map((t) => (
                                <span key={t} className="rounded-full bg-base px-2 py-0.5 text-[10px] font-medium text-ink/50">{t}</span>
                              ))}
                            </div>
                          )}

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <span className={cn("flex items-center gap-1 text-[11px] font-medium", overdue ? "text-red-600" : "text-ink/45")}>
                              <FaCalendarAlt className="h-3 w-3" />
                              {lead.dueDate ? (overdue ? `Overdue ${formatDate(lead.dueDate)}` : `Due ${formatDate(lead.dueDate)}`) : "No due date"}
                            </span>
                            {lead.assignedToName && (
                              <span className="flex items-center gap-1 text-[11px] text-ink/45" title={lead.assignedToName}>
                                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary-gradient text-[9px] font-bold text-white">
                                  {initials(lead.assignedToName)}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base">
                            <div className={cn("h-full rounded-full", meta.solid)} style={{ width: `${progressPercent(lead.status)}%` }} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Move modal */}
      <Modal open={!!moveTarget} onClose={() => setMoveTarget(null)} title="Move lead in pipeline" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoveTarget(null)}>Cancel</Button>
            <Button onClick={confirmMove} loading={savingMove}>Move lead</Button>
          </>
        }>
        {moveTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-base p-3 text-sm">
              <div className="text-xs text-ink/40">Lead</div>
              <div className="font-medium text-ink">{moveTarget.lead.name} · {moveTarget.lead.email}</div>
            </div>
            <Field label="Stage change">
              <div className="flex items-center gap-2 rounded-lg border border-base bg-base/40 px-3 py-2 text-sm">
                <Badge value={moveTarget.lead.status} />
                <FaArrowRight className="h-3 w-3 text-ink/30" />
                <Badge value={moveTarget.toStage} />
              </div>
            </Field>
            <Field label="Note (optional)" hint="Recorded on the lead's timeline with your name">
              <Textarea rows={3} value={moveNote} onChange={(e) => setMoveNote(e.target.value)} placeholder="e.g. Client approved budget, moving to quotation" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Notifications modal */}
      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="Pipeline alerts" size="lg">
        {!notifications ? (
          <Loading label="Loading alerts..." />
        ) : (
          <div className="space-y-6">
            <NotifSection
              icon={<FaClock className="h-3.5 w-3.5 text-red-500" />}
              title="Follow-ups overdue"
              empty="No overdue follow-ups"
              items={notifications.followUps}
              renderLead={(l) => <LeadNotifRow lead={l} onClick={() => { setNotifOpen(false); openLead(l); }} />}
            />
            <NotifSection
              icon={<FaTasks className="h-3.5 w-3.5 text-amber-500" />}
              title="Pending reminders"
              empty="No pending reminders"
              items={notifications.pendingReminders}
              renderLead={(l) => <LeadNotifRow lead={l} onClick={() => { setNotifOpen(false); openLead(l); }} badge="due" />}
            />
            <NotifSection
              icon={<FaFileInvoiceDollar className="h-3.5 w-3.5 text-purple-500" />}
              title="Overdue invoices"
              empty="No overdue invoices"
              items={notifications.overdueInvoices}
              renderInvoice={(i) => (
                <button
                  onClick={() => { setNotifOpen(false); navigate(`/admin/invoices/${i._id}`); }}
                  className="flex w-full items-center justify-between rounded-lg border border-base bg-white px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{i.invoiceNumber} · {i.clientName}</div>
                    <div className="truncate text-xs text-ink/45">{i.projectName}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-bold text-red-600">{formatMoney(i.balanceDue)}</div>
                    <div className="text-ink/40">Due {formatDate(i.dueDate)}</div>
                  </div>
                </button>
              )}
            />
            <NotifSection
              icon={<FaPaperPlane className="h-3.5 w-3.5 text-cyan-500" />}
              title="Delayed milestones"
              empty="No delayed milestones"
              items={notifications.delayedMilestones}
              renderLead={(l) => <LeadNotifRow lead={l} onClick={() => { setNotifOpen(false); openLead(l); }} badge="overdue" />}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function NotifSection({ icon, title, empty, items = [], renderLead, renderInvoice }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wide text-ink/50">
        {icon} {title} {items.length > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="rounded-lg bg-base/60 px-3 py-3 text-xs text-ink/40">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {(renderLead ? items.map((i) => renderLead(i)) : renderInvoice ? items.map((i) => renderInvoice(i)) : null)}
        </div>
      )}
    </div>
  );
}

function LeadNotifRow({ lead, onClick, badge }) {
  const overdue = badge === "overdue" || isOverdue(lead.dueDate);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-base bg-white px-3 py-2.5 text-left transition-colors hover:border-primary/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-[10px] font-bold text-white">
          {initials(lead.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{lead.name}</div>
          <div className="truncate text-xs text-ink/45">{lead.company || lead.service || "—"}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge value={lead.status} />
        {lead.dueDate && (
          <span className={cn("flex items-center gap-1 text-[11px] font-medium", overdue ? "text-red-600" : "text-ink/40")}>
            <FaCalendarAlt className="h-3 w-3" /> {formatDate(lead.dueDate)}
          </span>
        )}
      </div>
    </button>
  );
}
