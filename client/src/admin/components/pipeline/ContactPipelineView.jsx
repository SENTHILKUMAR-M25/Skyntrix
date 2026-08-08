import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaPhoneAlt, FaArrowRight, FaClipboardList, FaFileInvoiceDollar, FaReceipt, FaCheckCircle,
} from "react-icons/fa";
import { adminGet } from "../../api";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading } from "../Ui";
import RequirementFormModal from "../requirements/RequirementFormModal";
import {
  CONTACT_PIPELINE_STAGES, contactStageMeta, contactProgressPercent,
  formatMoney, formatMobileNumber, formatDate,
} from "../../utils/requirement";
import { cn } from "../../../lib/utils";

const nextActions = (c, navigate, onCollect) => {
  const stage = c.pipelineStage;
  switch (stage) {
    case "lead":
    case "contact":
      return [
        { label: "Contact", to: `/admin/lead-contacts/${c._id}` },
        { label: "Collect Requirement", onClick: () => onCollect(c) },
      ];
    case "requirement_collected":
      return [
        { label: "Create Quotation", to: c.requirement ? `/admin/quotations/create?requirementId=${c.requirement._id}` : `/admin/quotations/create?contactId=${c._id}` },
        c.requirement ? { label: "Open Requirement", to: `/admin/requirements` } : null,
      ].filter(Boolean);
    case "ready_for_quotation":
      return [{ label: "Create Quotation", to: `/admin/quotations/create?requirementId=${c.requirement?._id || ""}${c.requirement ? "" : `&contactId=${c._id}`}` }];
    case "quotation_created":
    case "quotation_accepted":
      return [
        { label: "View Quotation", to: c.quotation ? `/admin/quotations/${c.quotation._id}` : `/admin/quotations` },
        { label: "Create Invoice", to: `/admin/invoices/create` },
      ];
    case "invoice_created":
      return [
        { label: "Record Payment", to: c.invoice ? `/admin/invoices/${c.invoice._id}` : `/admin/invoices/create` },
        { label: "View Invoice", to: c.invoice ? `/admin/invoices/${c.invoice._id}` : `/admin/invoices` },
      ];
    default:
      return [
        { label: "View Invoice", to: c.invoice ? `/admin/invoices/${c.invoice._id}` : `/admin/invoices` },
      ];
  }
};

const OVERDUE = (d) => !!d && new Date(d).getTime() < Date.now();

export default function ContactPipelineView() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ board: [], summary: {} });
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await adminGet("/lead-contacts/pipeline-board", params);
      setData(res.data || { board: [], summary: {} });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  const summary = data.summary || {};

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search contacts, business, person, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <SummaryChip label="Contacts" value={summary.totalCount ?? 0} className="text-ink" />
        <SummaryChip label="Ready for Quotation" value={summary.readyForQuotation ?? 0} className="text-violet-600" />
        <SummaryChip label="Quotations" value={summary.quotationCount ?? 0} className="text-amber-600" />
        <SummaryChip label="Invoices" value={summary.invoiceCount ?? 0} className="text-blue-600" />
        <SummaryChip label="Completed" value={summary.completed ?? 0} className="text-teal-600" />
        <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm">
          Pipeline value · {formatMoney(summary.estimatedValue ?? 0)}
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <Loading label="Loading pipeline..." />
      ) : !(data.board || []).length ? (
        <EmptyState title="No contacts in the pipeline" hint="Convert or create lead contacts and collect their requirements." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(data.board || []).map((col) => {
            const meta = contactStageMeta(col.stage);
            return (
              <div key={col.stage} className="w-72 shrink-0 rounded-2xl border border-base bg-white/70">
                <div className="flex items-center justify-between gap-2 border-b border-base px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                    <span className="truncate text-sm font-bold text-ink">{col.label}</span>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-base px-1.5 text-[11px] font-semibold text-ink/60">
                      {col.count}
                    </span>
                  </div>
                  {col.contacts.some((c) => c.requirement?.estimate) && (
                    <span className="shrink-0 text-[11px] font-semibold text-ink/45">
                      {formatMoney(col.contacts.reduce((a, c) => a + (c.requirement?.estimate || 0), 0))}
                    </span>
                  )}
                </div>

                <div className="min-h-24 space-y-2.5 p-2.5">
                  {col.contacts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-base py-6 text-center text-xs text-ink/30">No contacts here</div>
                  )}
                  {col.contacts.map((c) => {
                    const overdue = OVERDUE(c.nextFollowUpAt);
                    const actions = nextActions(c, navigate, (contact) => setFormState({ contact }));
                    return (
                      <div
                        key={c._id}
                        onClick={() => navigate(`/admin/lead-contacts/${c._id}`)}
                        className="group cursor-pointer rounded-xl border border-base bg-white p-3 shadow-sm transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{c.businessName || "Unnamed business"}</div>
                            {c.contactPerson && <div className="truncate text-xs text-ink/45">{c.contactPerson}</div>}
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink/60">
                            <FaPhoneAlt className="h-3 w-3 text-primary" /> {formatMobileNumber(c.mobileNumber)}
                          </span>
                        </div>

                        {c.summary && <p className="mt-1.5 line-clamp-2 text-xs text-ink/45">{c.summary}</p>}

                        {/* Document chips */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.requirement && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                              <FaClipboardList className="h-2.5 w-2.5" /> Requirement
                            </span>
                          )}
                          {c.quotation && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <FaFileInvoiceDollar className="h-2.5 w-2.5" /> Quotation
                            </span>
                          )}
                          {c.invoice && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              <FaReceipt className="h-2.5 w-2.5" /> Invoice
                            </span>
                          )}
                          {c.pipelineStage === "completed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                              <FaCheckCircle className="h-2.5 w-2.5" /> Done
                            </span>
                          )}
                        </div>

                        {c.requirement?.projectName && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-ink/50">
                            <FaArrowRight className="h-2.5 w-2.5 text-primary/50" />
                            <span className="truncate">{c.requirement.projectName}</span>
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                          {c.nextFollowUpAt ? (
                            <span className={cn("font-medium", overdue ? "text-red-600" : "text-ink/45")}>
                              {overdue ? "Follow-up overdue" : `Next follow-up ${formatDate(c.nextFollowUpAt)}`}
                            </span>
                          ) : (
                            <span className="text-ink/30">{c.lastContactAt ? `Contacted ${formatDate(c.lastContactAt)}` : "Not contacted yet"}</span>
                          )}
                          {c.requirement?.estimate > 0 && (
                            <span className="font-bold text-primary">{formatMoney(c.requirement.estimate)}</span>
                          )}
                        </div>

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base">
                          <div className={cn("h-full rounded-full", meta.solid)} style={{ width: `${contactProgressPercent(c.pipelineStage)}%` }} />
                        </div>

                        {actions.length > 0 && (
                          <div className="mt-2.5 flex gap-2 border-t border-base/70 pt-2.5">
                            {actions.map((a) => (
                              <Button
                                key={a.label}
                                size="sm"
                                variant="secondary"
                                className="flex-1 !px-2 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (a.onClick) a.onClick();
                                  else if (a.to) navigate(a.to);
                                }}
                              >
                                {a.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formState && (
        <RequirementFormModal
          open={true}
          onClose={() => setFormState(null)}
          contact={formState.contact}
          onSaved={() => { setFormState(null); fetchBoard(); }}
        />
      )}
    </div>
  );
}

function SummaryChip({ label, value, className }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-sm">
      <span className={cn("text-base font-extrabold", className)}>{value}</span>
      <span className="ml-1.5 text-xs font-medium text-ink/50">{label}</span>
    </div>
  );
}
