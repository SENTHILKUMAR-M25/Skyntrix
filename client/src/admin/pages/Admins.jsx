import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaPen, FaShieldAlt } from "react-icons/fa";
import { adminGet, adminPost, adminPut, adminDelete } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import { Badge, Button, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Switch } from "../components/Ui";

const roleOptions = [
  { value: "super-admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "content-manager", label: "Content Manager" },
];

export default function Admins() {
  const { admin: me } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin", isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage = me?.role === "super-admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet("/auth/admins");
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", email: "", password: "", role: "admin", isActive: true });
    setError("");
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm({ name: row.name, email: row.email, password: "", role: row.role, isActive: row.isActive });
    setError("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError("Name and email are required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.name, email: form.email, role: form.role, isActive: form.isActive };
      if (form.password) payload.password = form.password;
      if (editingId) {
        await adminPut(`/auth/admins/${editingId}`, payload);
        toast.ok("Admin updated");
      } else {
        await adminPost("/auth/admins", payload);
        toast.ok("Admin created");
      }
      setOpen(false);
      fetchData();
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    if (row._id === me?._id) { toast.info("You cannot deactivate your own account"); return; }
    try {
      await adminPut(`/auth/admins/${row._id}`, { isActive: !row.isActive });
      toast.info("Account updated");
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (row) => {
    if (row.role === "super-admin") { toast.info("The primary super-admin cannot be deleted"); return; }
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await adminDelete(`/auth/admins/${row._id}`);
      toast.ok("Admin deleted");
      fetchData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle={canManage ? "Manage admin accounts and roles" : "You must be a super admin to manage accounts"}
        action={canManage && <Button onClick={openCreate}><FaPlus /> New admin</Button>}
      />

      {!canManage && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FaShieldAlt /> Only super admins can manage admin accounts.
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState title="No admins" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base text-sm">
              <thead className="bg-base/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink/60">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-base/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      {row._id === me?._id && <div className="text-xs text-primary">You</div>}
                    </td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3"><Badge value={row.role} /></td>
                    <td className="px-4 py-3">
                      {canManage && row._id !== me?._id ? (
                        <Switch checked={!!row.isActive} onChange={() => toggleActive(row)} />
                      ) : (
                        <Badge value={row.isActive ? "active" : "inactive"} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(row)} className="rounded-md p-2 text-ink/50 hover:bg-primary/10 hover:text-primary" title="Edit">
                            <FaPen className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(row)} disabled={row._id === me?._id}
                            className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" title="Delete">
                            ✕
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Edit admin" : "New admin"} size="sm"
        footer={
          <>
            {error && <span className="mr-auto text-sm text-red-600">{error}</span>}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }>
        <div className="space-y-4">
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {!editingId && (
            <Field label="Password" required hint="Min 8 characters"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          )}
          <Field label="Role"><Select value={form.role} options={roleOptions} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={false} /></Field>
        </div>
      </Modal>
    </div>
  );
}