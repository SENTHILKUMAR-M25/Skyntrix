import { useEffect, useState } from "react";
import { adminGet, adminPut } from "../api";
import { useToast } from "../Toast";
import { Button, Input, Loading, PageHeader, Field, Textarea } from "../components/Ui";

const groups = [
  { key: "company", label: "Company", fields: ["name", "shortName", "tagline", "email", "careersEmail", "phone", "whatsapp", "address", "hours"] },
  { key: "social", label: "Social", fields: ["linkedin", "twitter", "instagram", "facebook", "github", "dribbble", "youtube"] },
  { key: "seo", label: "SEO", fields: ["metaTitle", "metaDescription"] },
  { key: "footer", label: "Footer", fields: ["copyright", "description"] },
  { key: "analytics", label: "Analytics", fields: ["googleAnalytics", "googleTagManager"] },
];

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({ logoMain: null, logoFooter: null, favicon: null, ogImage: null });

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminGet("/settings/admin");
      const s = res.data;
      setSettings(s);
      const f = {};
      for (const g of groups) {
        const grp = s[g.key] || {};
        for (const field of g.fields) f[`${g.key}.${field}`] = grp[field] ?? "";
      }
      setForm(f);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      for (const g of groups) {
        const obj = {};
        for (const field of g.fields) obj[field] = form[`${g.key}.${field}`] || "";
        fd.append(g.key, JSON.stringify(obj));
      }
      Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v); });
      await adminPut("/settings/admin", fd, true);
      toast.ok("Settings saved");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const preview = (field) => {
    if (!settings) return null;
    if (field === "logoMain") return settings.logo?.main;
    if (field === "logoFooter") return settings.logo?.footer;
    if (field === "favicon") return settings.logo?.favicon;
    if (field === "ogImage") return settings.seo?.ogImage;
    return null;
  };

  return (
    <div>
      <PageHeader
        title="Site Settings"
        subtitle="Company info, social links, SEO and analytics"
        action={<Button onClick={handleSave} loading={saving}>{saving ? "Saving..." : "Save changes"}</Button>}
      />

      <div className="space-y-6">
        {/* Logos */}
        <div className="card p-5">
          <h2 className="mb-4 font-display font-bold text-ink">Logos & Media</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["logoMain", "Main logo"],
              ["logoFooter", "Footer logo"],
              ["favicon", "Favicon"],
              ["ogImage", "Social share image"],
            ].map(([key, label]) => {
              const current = preview(key);
              return (
                <div key={key}>
                  <Field label={label}>
                    <div className="flex items-center gap-3">
                      {current && <img src={current} alt="" className="h-12 w-12 rounded-lg bg-base object-cover" />}
                      <input type="file" accept="image/*" onChange={(e) => setFiles((f) => ({ ...f, [key]: e.target.files?.[0] || null }))}
                        className="block w-full text-sm text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary" />
                    </div>
                  </Field>
                </div>
              );
            })}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.key} className="card p-5">
            <h2 className="mb-4 font-display font-bold text-ink">{g.label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {g.fields.map((field) => (
                <Field key={field} label={field.replace(/^(\w)/, (m) => m.toUpperCase()).replace(/[A-Z]/g, (m) => " " + m.toLowerCase())}>
                  {field === "metaDescription" || field === "description" ? (
                    <Textarea value={form[`${g.key}.${field}`] || ""} rows={2} onChange={(e) => set(`${g.key}.${field}`, e.target.value)} />
                  ) : (
                    <Input value={form[`${g.key}.${field}`] || ""} onChange={(e) => set(`${g.key}.${field}`, e.target.value)} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}