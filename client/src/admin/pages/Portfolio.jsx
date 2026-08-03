import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaPen, FaTrash, FaSearch } from "react-icons/fa";
import { adminGet, adminPost, adminPut, adminDelete } from "../api";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Switch, Textarea } from "../components/Ui";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const fields = [
  { name: "title", label: "Title", required: true, fullWidth: true },
  { name: "client", label: "Client" },
  { name: "duration", label: "Duration", placeholder: "e.g. 12 weeks" },
  { name: "industry", label: "Industry" },
  { name: "category", label: "Category" },
  { name: "displayOrder", label: "Display order", type: "number" },
  { name: "status", label: "Status", type: "select", options: statusOptions },
  { name: "featured", label: "Featured", type: "switch" },
  { name: "liveDemo", label: "Live demo URL", fullWidth: true },
  { name: "github", label: "GitHub URL", fullWidth: true },
  { name: "overview", label: "Overview", type: "textarea", rows: 4, fullWidth: true },
  { name: "description", label: "Description", type: "textarea", rows: 5, fullWidth: true },
  { name: "problem", label: "Problem", type: "textarea", rows: 3, fullWidth: true },
  { name: "solution", label: "Solution", type: "textarea", rows: 3, fullWidth: true },
  { name: "results", label: "Results", type: "textarea", rows: 3, fullWidth: true },
  { name: "technologies", label: "Technologies (comma separated)", type: "tags", fullWidth: true },
];

const toFormValues = (row) => {
  const v = {};
  for (const f of fields) {
    if (f.type === "tags") v[f.name] = Array.isArray(row?.[f.name]) ? row[f.name].join(", ") : "";
    else if (f.type === "switch") v[f.name] = !!row?.[f.name];
    else v[f.name] = row?.[f.name] ?? "";
  }
  return v;
};

export default function Portfolio() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [thumb, setThumb] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet("/portfolio/admin", { search, page, limit: 10 });
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(toFormValues({}));
    setThumb(null);
    setGallery([]);
    setError("");
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm(toFormValues(row));
    setThumb(null);
    setGallery([]);
    setError("");
    setOpen(true);
  };

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const buildFormData = () => {
    const fd = new FormData();
    for (const f of fields) {
      const v = form[f.name];
      if (v === undefined || v === null) continue;
      if (f.type === "tags") {
        String(v).split(",").map((s) => s.trim()).filter(Boolean).forEach((t) => fd.append(f.name, t));
        continue;
      }
      if (typeof v === "boolean") { fd.append(f.name, v ? "true" : "false"); continue; }
      fd.append(f.name, v);
    }
    if (thumb) fd.append("image", thumb);
    gallery.forEach((g) => fd.append("images", g));
    return fd;
  };

  const handleSave = async () => {
    if (fields.some((f) => f.required && !String(form[f.name] || "").trim())) {
      setError("Portfolio requires all fields marked *");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = buildFormData();
      const url = `/portfolio/admin${editingId ? `/${editingId}` : ""}`;
      if (editingId) await adminPut(url, fd, true);
      else await adminPost(url, fd);
      toast.ok(`Project ${editingId ? "updated" : "created"}`);
      close();
      fetchData();
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await adminDelete(`/portfolio/admin/${deletingId}`);
      toast.ok("Project deleted");
      setDeletingId(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
      setDeletingId(null);
    }
  };

  const changeStatus = async (row, value) => {
    try {
      await adminPut(`/portfolio/admin/${row._id}/status`, { status: value });
      toast.info("Status updated");
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const thumbnail = form.thumbnail;

  return (
    <div>
      <PageHeader
        title="Portfolio"
        subtitle="Manage your project showcases"
        action={<Button onClick={openCreate}><FaPlus /> New project</Button>}
      />

      <div className="card mb-4 flex items-center gap-3 p-3">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input className="pl-9" placeholder="Search projects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="No projects found" hint="Try adjusting your search or create one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60" />
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-base/40">
                    <td className="px-4 py-3">
                      {row.thumbnail && <img src={row.thumbnail} alt="" className="h-10 w-14 rounded-lg object-cover" />}
                    </td>
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">{row.client || "—"}</td>
                    <td className="px-4 py-3">{row.category || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge value={row.status} />
                        <Select className="w-auto !py-0.5 text-xs" value={row.status} onChange={(e) => changeStatus(row, e.target.value)} options={statusOptions} placeholder={false} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Edit">
                        <FaPen className="h-3.5 w-3.5" />
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit project" : "New project"}
        size="xl"
        footer={
          <>
            {error && <span className="mr-auto text-sm text-red-600">{error}</span>}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.fullWidth ? "sm:col-span-2" : ""}>
              {f.type === "textarea" ? (
                <Field label={f.label} required={f.required}>
                  <Textarea value={form[f.name] || ""} rows={f.rows || 4} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} />
                </Field>
              ) : f.type === "select" ? (
                <Field label={f.label} required={f.required}>
                  <Select value={form[f.name] || ""} options={f.options || []} onChange={(e) => setField(f.name, e.target.value)} />
                </Field>
              ) : f.type === "switch" ? (
                <div className="mt-6"><Switch checked={!!form[f.name]} onChange={(v) => setField(f.name, v)} label={f.label} /></div>
              ) : f.type === "number" ? (
                <Field label={f.label} required={f.required}>
                  <Input type="number" value={form[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} />
                </Field>
              ) : (
                <Field label={f.label} required={f.required}>
                  <Input value={form[f.name] || ""} onChange={(e) => setField(f.name, e.target.value)} />
                </Field>
              )}
            </div>
          ))}

          <div className="sm:col-span-2">
            <Field label="Thumbnail image">
              <div className="flex items-center gap-3">
                {thumbnail && <img src={thumbnail} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                <input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary" />
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Gallery images (optional, multiple)">
              <input type="file" accept="image/*" multiple onChange={(e) => setGallery([...e.target.files])}
                className="block w-full text-sm text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary" />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete project"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-ink/70">Delete this project? This cannot be undone.</p>
      </Modal>
    </div>
  );
}