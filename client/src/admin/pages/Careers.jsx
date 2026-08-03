import { useCallback, useEffect, useState } from "react";
import { FaSearch, FaTrash, FaEye, FaFileDownload } from "react-icons/fa";
import { adminGet, adminPut, adminDelete } from "../api";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from "../components/Ui";

const statusOptions = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "interviewed", label: "Interviewed" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
  { value: "archived", label: "Archived" },
];

export default function Careers() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [notes, setNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (status !== "all") params.status = status;
      const res = await adminGet("/careers/admin", params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, status, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeStatus = async (row, value) => {
    try {
      await adminPut(`/careers/admin/${row._id}/status`, { status: value });
      toast.info("Status updated");
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openView = (row) => {
    setViewing(row);
    setNotes(row.notes || "");
  };

  const saveNotes = async () => {
    try {
      await adminPut(`/careers/admin/${viewing._id}/notes`, { notes });
      toast.ok("Notes saved");
      setViewing((v) => (v ? { ...v, notes } : v));
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      await adminDelete(`/careers/admin/${deletingId}`);
      toast.ok("Application deleted");
      setDeletingId(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Career Applications" subtitle="Submitted via the careers page" />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search applications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select className="sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...statusOptions]} placeholder={false} />
      </div>

      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState title="No applications found" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Candidate</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Position</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Experience</th>
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
                      <div className="text-xs text-ink/40">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">{row.position || "—"}</td>
                    <td className="px-4 py-3">{row.experience || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge value={row.status} />
                        <Select className="w-auto !py-0.5 text-xs" value={row.status} onChange={(e) => changeStatus(row, e.target.value)} options={statusOptions} placeholder={false} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink/50">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openView(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="View">
                        <FaEye className="h-3.5 w-3.5" />
                      </button>
                      {row.resume && (
                        <a href={row.resume} target="_blank" rel="noreferrer" className="inline-block rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Resume">
                          <FaFileDownload className="h-3.5 w-3.5" />
                        </a>
                      )}
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

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Application details" size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            <Button onClick={saveNotes}>Save notes</Button>
          </>
        }>
        {viewing && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Name", viewing.name],
                ["Email", viewing.email],
                ["Phone", viewing.phone],
                ["Position", viewing.position],
                ["Experience", viewing.experience],
                ["Portfolio", viewing.portfolio],
                ["Applied", new Date(viewing.createdAt).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-base p-3">
                  <dt className="text-xs text-ink/40">{k}</dt>
                  <dd className="text-sm font-medium text-ink">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {viewing.message && (
              <div className="rounded-lg bg-base p-3 text-sm text-ink/70"><strong>Message:</strong><br />{viewing.message}</div>
            )}
            <Field label="Internal notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete application" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </>}>
        <p className="text-ink/70">Delete this application (and its resume)? This cannot be undone.</p>
      </Modal>
    </div>
  );
}