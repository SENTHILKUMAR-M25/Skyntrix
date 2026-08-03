import { useCallback, useEffect, useMemo, useState } from "react";
import { FaPlus, FaPen, FaTrash, FaSearch } from "react-icons/fa";
import { adminGet, adminPost, adminPut, adminDelete } from "../api";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Switch, Textarea } from "./Ui";

const toFormValues = (fields, row) => {
  const values = {};
  for (const f of fields) {
    const v = row?.[f.name];
    if (f.type === "tags") values[f.name] = Array.isArray(v) ? v.join(", ") : "";
    else if (f.type === "switch") values[f.name] = !!v;
    else values[f.name] = v ?? "";
  }
  return values;
};

export default function CrudPage({ config }) {
  const { title, singular, apiPath: api, columns, fields, statusOptions, statusKey = "status", imageField, imagePreviewKey } = config;

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
  const [file, setFile] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const listPath = useMemo(() => `/${api}/admin`, [api]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet(listPath, { search, page, limit: 10 });
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [listPath, search, page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(toFormValues(fields, {}));
    setFile(null);
    setError("");
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm(toFormValues(fields, row));
    setFile(null);
    setError("");
    setOpen(true);
  };

  const close = () => setOpen(false);
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
    if (file) fd.append(imageField, file);
    return fd;
  };

  const handleSave = async () => {
    if (fields.some((f) => f.required && !String(form[f.name] || "").trim())) {
      setError(`${singular}: please complete all required fields.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = `${api}/admin${editingId ? `/${editingId}` : ""}`;
      const fd = buildFormData();
      if (editingId) await adminPut(url, fd, true);
      else await adminPost(url, fd);
      toast.ok(`${singular} ${editingId ? "updated" : "created"}`);
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
      await adminDelete(`/${api}/admin/${deletingId}`);
      toast.ok(`${singular} deleted`);
      setDeletingId(null);
      fetchData();
    } catch (e) {
      toast.error(e.message);
      setDeletingId(null);
    }
  };

  const changeStatus = async (row, value) => {
    try {
      await adminPut(`/${api}/admin/${row._id}/status`, { status: value });
      toast.info("Status updated");
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const tableCols = columns || [{ key: "title", label: singular }, { key: statusKey, label: "Status" }];
  const imgUrl = imagePreviewKey ? form[imagePreviewKey] : null;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`Manage your ${title.toLowerCase()} entries`}
        action={<Button onClick={openCreate}><FaPlus /> New</Button>}
      />

      <div className="card mb-4 flex items-center gap-3 p-3">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <Input
            className="pl-9"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} found`} hint="Try adjusting your search or create one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  {tableCols.map((c) => (
                    <th key={c.key || c.label} className="px-4 py-3 text-left font-semibold text-ink/60">{c.label}</th>
                  ))}
                  {statusOptions && <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>}
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-base/40">
                    {tableCols.map((c) => (
                      <td key={c.key || c.label} className="px-4 py-3">
                        {c.render ? c.render(row) : (
                          <span className="flex items-center gap-2">
                            {c.image && row[c.key] && <img src={row[c.key]} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                            <span>{row[c.key] ?? "—"}</span>
                          </span>
                        )}
                      </td>
                    ))}
                    {statusOptions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge value={row[statusKey]} />
                          <Select
                            className="w-auto !py-0.5 text-xs"
                            value={row[statusKey]}
                            onChange={(e) => changeStatus(row, e.target.value)}
                            options={statusOptions}
                            placeholder={false}
                          />
                        </div>
                      </td>
                    )}
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
        onClose={close}
        title={editingId ? `Edit ${singular}` : `New ${singular}`}
        size="lg"
        footer={
          <>
            {error && <span className="mr-auto text-sm text-red-600">{error}</span>}
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.fullWidth ? "sm:col-span-2" : ""}>
              {f.type === "textarea" ? (
                <Field label={f.label} required={f.required} hint={f.hint}>
                  <Textarea value={form[f.name] || ""} rows={f.rows || 4} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} />
                </Field>
              ) : f.type === "select" ? (
                <Field label={f.label} required={f.required}>
                  <Select value={form[f.name] || ""} options={f.options || []} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} />
                </Field>
              ) : f.type === "switch" ? (
                <div className="mt-6">
                  <Switch checked={!!form[f.name]} onChange={(v) => setField(f.name, v)} label={f.label} />
                </div>
              ) : f.type === "number" ? (
                <Field label={f.label} required={f.required}>
                  <Input type="number" value={form[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} />
                </Field>
              ) : (
                <Field label={f.label} required={f.required} hint={f.hint}>
                  <Input value={form[f.name] || ""} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} />
                </Field>
              )}
            </div>
          ))}

          {imageField && (
            <div className="sm:col-span-2">
              <Field label={`${singular} image`} hint="Optional — replaces the current image when uploaded.">
                <div className="flex items-center gap-3">
                  {imgUrl && <img src={imgUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary"
                  />
                </div>
              </Field>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title={`Delete ${singular}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-ink/70">Are you sure you want to delete this {singular.toLowerCase()}? This cannot be undone.</p>
      </Modal>
    </div>
  );
}