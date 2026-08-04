import { useCallback, useEffect, useState } from "react";
import { FaSearch, FaCopy, FaRedoAlt, FaWhatsapp } from "react-icons/fa";
import { adminGet, adminPost } from "../../api";
import { useToast } from "../../Toast";
import { Button, EmptyState, Input, Loading, Modal, PageHeader, Select } from "../../components/Ui";
import WhatsAppPreviewModal from "../../components/lead-contacts/WhatsAppPreviewModal";
import { SEND_LOG_STATUS_OPTIONS, formatMobileNumber, fullDateTime } from "../../utils/leadContact";

const STATUS_BADGE = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  fallback: "bg-blue-100 text-blue-700 border-blue-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

export default function SentHistory() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState("");

  const [retryTarget, setRetryTarget] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, status, page, limit: 15 };
      const res = await adminGet("/lead-contacts/history", params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, status, page, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doRetry = async () => {
    if (!retryTarget) return;
    setSending(true);
    try {
      const res = await adminPost(`/lead-contacts/resend/${retryTarget.leadContactId}`);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("WhatsApp resent successfully");
      } else {
        toast.error("WhatsApp resend failed");
      }
      setRetryTarget(null);
      setConfirmRetry(false);
      fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (log) => {
    copy(log.message);
    setCopiedId(log._id);
    setTimeout(() => setCopiedId(""), 1400);
  };

  return (
    <div>
      <PageHeader
        title="Sent History"
        subtitle="Every WhatsApp message sent to leads, with delivery status."
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder="Search business or mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select className="sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...SEND_LOG_STATUS_OPTIONS]} placeholder={false} />
      </div>

      <div className="card overflow-hidden">
        {loading ? <Loading label="Loading history..." /> : rows.length === 0 ? (
          <EmptyState title="No messages sent yet" hint="Send a WhatsApp message from Create Lead or the Leads table to see it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Business</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Mobile</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Message</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Sent by</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Sent at</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((log) => (
                  <tr key={log._id} className="transition-colors hover:bg-base/40">
                    <td className="px-4 py-3 font-semibold text-ink">{log.businessName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">{formatMobileNumber(log.mobileNumber)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[log.status] || STATUS_BADGE.failed}`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3 text-ink/70 capitalize">{log.method === "api" ? "Cloud API" : "WhatsApp Web"}</td>
                    <td className="max-w-[240px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-2 text-ink/60" title={log.message}>{log.message?.split("\n").slice(0, 4).join(" ")}</span>
                        <button onClick={() => handleCopy(log)} className="shrink-0 text-ink/30 hover:text-primary" title="Copy message">
                          {copiedId === log._id ? <span className="text-[10px] text-emerald-600">copied</span> : <FaCopy className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/70">{log.sentByName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/50">{fullDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setRetryTarget(log); setConfirmRetry(false); }}
                        className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary"
                        title="Preview message again"
                      >
                        <FaWhatsapp className="h-3.5 w-3.5" />
                      </button>
                      {(log.status === "failed" || log.status === "fallback") && (
                        <button
                          onClick={() => { setRetryTarget(log); setConfirmRetry(true); }}
                          className="rounded-md p-2 text-ink/50 hover:bg-emerald-50 hover:text-emerald-700"
                          title="Retry failed message"
                        >
                          <FaRedoAlt className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-base px-4 py-3 text-sm">
            <span className="text-ink/50">Page {meta.page} of {meta.totalPages} · {meta.totalItems} total</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!meta.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview + retry */}
      <WhatsAppPreviewModal
        open={!!retryTarget && !confirmRetry}
        onClose={() => setRetryTarget(null)}
        lead={retryTarget ? {
          businessName: retryTarget.businessName,
          mobileNumber: retryTarget.mobileNumber,
        } : null}
        message={retryTarget?.message}
        onSend={doRetry}
        sending={sending}
        title="Preview message"
      />

      <Modal open={!!retryTarget && confirmRetry} onClose={() => setRetryTarget(null)} title="Retry WhatsApp message" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRetryTarget(null)}>Cancel</Button>
          <Button onClick={doRetry} loading={sending} className="bg-[#25D366] hover:bg-[#1fb959]"><FaWhatsapp /> Retry now</Button>
        </>}>
        <p className="text-ink/70">
          Resend the WhatsApp message to <span className="font-semibold">{retryTarget?.businessName}</span> ({formatMobileNumber(retryTarget?.mobileNumber)})?
        </p>
      </Modal>
    </div>
  );
}
