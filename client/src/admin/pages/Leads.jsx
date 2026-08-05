import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaTrash, FaEye, FaArrowRight, FaWhatsapp, FaAddressBook, FaColumns } from "react-icons/fa";
import { adminGet, adminPut, adminDelete, adminPost } from "../api";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from "../components/Ui";
import { ALL_STAGES } from "../utils/pipeline";

const statusOptions = ALL_STAGES.map((s) => ({ value: s.value, label: s.label }));

export default function Leads() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [convertingId, setConvertingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (status !== "all") params.status = status;
      const res = await adminGet("/leads/admin", params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, status, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openStatusModal = (row, value) => {
    if (value === row.status) {
      toast.info("Lead is already in that status");
      return;
    }
    setStatusTarget({ ...row, nextStatus: value });
    setStatusNote("");
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    setSavingStatus(true);
    try {
      await adminPut(`/leads/admin/${statusTarget._id}/status`, {
        status: statusTarget.nextStatus,
        note: statusNote.trim(),
      });
      toast.ok(`Status updated to ${statusTarget.nextStatus} and logged`);
      setStatusTarget(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    try {
      await adminDelete(`/leads/admin/${deletingId}`);
      toast.ok("Lead deleted");
      setDeletingId(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
      setDeletingId(null);
    }
  };

  const handleConvert = async (row) => {
    if (!row.phone) {
      toast.error(`Cannot convert "${row.name}": the inquiry has no phone number`);
      return;
    }
    setConvertingId(row._id);
    try {
      const res = await adminPost(`/lead-contacts/convert/${row._id}`);
      const data = res.data || {};
      const id = data.lead ? data.lead._id : data._id;
      toast.ok(data.alreadyConverted ? "Lead was already converted — opening it" : "Converted to Lead Contact");
      navigate(`/admin/lead-contacts/${id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Inquiries submitted through the contact form"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/admin/pipeline")}>
              <FaColumns className="h-4 w-4" /> Pipeline Board
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/lead-contacts")}>
              <FaAddressBook className="h-4 w-4" /> Lead Contacts
            </Button>
          </div>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search leads..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select className="sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...statusOptions]} placeholder={false} />
      </div>

      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="No leads found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Service</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Date</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-base/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-ink/40">{row.company || ""} {row.budget ? `· ${row.budget}` : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.email}</div>
                      <div className="text-xs text-ink/40">{row.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3">{row.service || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge value={row.status} />
                        <Select className="w-auto !py-0.5 text-xs" value={row.status} onChange={(e) => openStatusModal(row, e.target.value)} options={statusOptions} placeholder={false} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/50">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => navigate(`/admin/leads/${row._id}`)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View details & timeline">
                        <FaEye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleConvert(row)} disabled={convertingId === row._id} className="rounded-md p-2 text-ink/50 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40" title="Convert to Lead Contact & send WhatsApp">
                        <FaWhatsapp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeletingId(row._id)} className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <FaTrash className="h-3.5 w-3.5" />
                      </button>
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

      <Modal open={!!statusTarget} onClose={() => setStatusTarget(null)} title="Update lead status" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={confirmStatus} loading={savingStatus}>Update status</Button>
          </>
        }>
        {statusTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-base p-3 text-sm">
              <div className="text-xs text-ink/40">Lead</div>
              <div className="font-medium text-ink">{statusTarget.name} · {statusTarget.email}</div>
            </div>
            <Field label="Status change">
              <div className="flex items-center gap-2 rounded-lg border border-base bg-base/40 px-3 py-2 text-sm">
                <Badge value={statusTarget.status} />
                <FaArrowRight className="h-3 w-3 text-ink/30" />
                <Badge value={statusTarget.nextStatus} />
              </div>
            </Field>
            <Field label="Note (optional)" hint="This reason is recorded with your name and timestamp on the lead's timeline">
              <Textarea rows={3} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. Client requested a proposal" />
            </Field>
          </div>
        )}
      </Modal>

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete lead" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this lead and its activity history? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
