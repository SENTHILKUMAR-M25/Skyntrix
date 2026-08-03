import { useCallback, useEffect, useState } from "react";
import { FaSearch, FaTrash, FaFileDownload } from "react-icons/fa";
import { adminGet, adminDelete } from "../api";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Input, Loading, Modal, PageHeader } from "../components/Ui";

export default function Newsletter() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState("all");
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 20 };
      if (active !== "all") params.active = active;
      const res = await adminGet("/newsletter/admin", params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, active, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    try {
      await adminDelete(`/newsletter/admin/${deletingId}`);
      toast.ok("Subscriber removed");
      setDeletingId(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Newsletter"
        subtitle="Manage email subscribers"
        action={
          <Button variant="secondary" onClick={() => window.open("/api/newsletter/admin/export", "_self")}>
            <FaFileDownload /> Export CSV
          </Button>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search subscribers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select
          className="rounded-lg border border-base bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-40"
          value={active}
          onChange={(e) => { setActive(e.target.value); setPage(1); }}
        >
          <option value="all">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState title="No subscribers found" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Subscribed</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-base/40">
                    <td className="px-4 py-3 font-medium">{row.email}</td>
                    <td className="px-4 py-3 text-ink/50">{new Date(row.subscribedAt || row.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><Badge value={row.isActive ? "active" : "inactive"} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeletingId(row._id)} className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-red-600" title="Remove">
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

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Remove subscriber" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Remove</Button>
        </>}>
        <p className="text-ink/70">Remove this subscriber? This cannot be undone.</p>
      </Modal>
    </div>
  );
}