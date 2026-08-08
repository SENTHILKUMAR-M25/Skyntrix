import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSave, FaFileInvoiceDollar, FaUser, FaProjectDiagram, FaCode,
  FaCoins, FaClipboardList, FaPlus, FaTrash, FaExternalLinkAlt,
} from "react-icons/fa";
import { FaListCheck } from "react-icons/fa6";
import { adminPost, adminPut } from "../../api";
import { useToast } from "../../Toast";
import { Button, Field, Input, Select, Switch, Textarea } from "../Ui";
import { formatMobileNumber, PROJECT_TYPES, REQUIREMENT_PRIORITIES } from "../../utils/requirement";

const BOOL_FIELDS = [
  ["adminPanelRequired", "Admin Panel Required"],
  ["paymentGatewayRequired", "Payment Gateway Required"],
  ["authenticationRequired", "Authentication Required"],
  ["whatsappIntegration", "WhatsApp Integration"],
  ["emailIntegration", "Email Integration"],
  ["hostingRequired", "Hosting Required"],
  ["domainRequired", "Domain Required"],
  ["maintenanceRequired", "Maintenance Required"],
];

const EMPTY = {
  businessName: "",
  clientName: "",
  mobileNumber: "",
  email: "",
  location: "",
  existingWebsite: "",
  socialMediaLinks: [""],
  projectType: "",
  projectName: "",
  businessDescription: "",
  projectDescription: "",
  mainObjective: "",
  targetAudience: "",
  requiredFeatures: "",
  numberOfPages: "",
  numberOfProducts: "",
  adminPanelRequired: false,
  paymentGatewayRequired: false,
  authenticationRequired: false,
  whatsappIntegration: false,
  emailIntegration: false,
  thirdPartyIntegrations: "",
  hostingRequired: false,
  domainRequired: false,
  maintenanceRequired: false,
  preferredTechnology: "",
  frontend: "",
  backend: "",
  database: "",
  apiRequirements: "",
  hostingDeploymentRequirements: "",
  otherTechnicalRequirements: "",
  clientBudget: "",
  expectedStartDate: "",
  expectedDeliveryDate: "",
  priority: "medium",
  estimatedDevelopmentCost: "",
  estimatedMaintenanceCost: "",
  clientExpectations: "",
  referenceWebsites: "",
  competitorWebsites: "",
  designPreferences: "",
  specialInstructions: "",
  internalNotes: "",
};

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const normalizeForSave = (form, contact) => ({
  contactId: contact?._id,
  businessName: (form.businessName || contact?.businessName || "").trim(),
  clientName: (form.clientName || contact?.contactPerson || contact?.businessName || "").trim(),
  mobileNumber: (form.mobileNumber || contact?.mobileNumber || "").trim(),
  email: (form.email || contact?.email || "").trim(),
  location: (form.location || contact?.location || "").trim(),
  existingWebsite: (form.existingWebsite || contact?.websiteLink || "").trim(),
  socialMediaLinks: (form.socialMediaLinks || []).map((s) => s.trim()).filter(Boolean),
  projectType: form.projectType,
  projectName: form.projectName.trim(),
  businessDescription: form.businessDescription.trim(),
  projectDescription: form.projectDescription.trim(),
  mainObjective: form.mainObjective.trim(),
  targetAudience: form.targetAudience.trim(),
  requiredFeatures: form.requiredFeatures.trim(),
  numberOfPages: Math.max(0, Number(form.numberOfPages) || 0),
  numberOfProducts: Math.max(0, Number(form.numberOfProducts) || 0),
  adminPanelRequired: Boolean(form.adminPanelRequired),
  paymentGatewayRequired: Boolean(form.paymentGatewayRequired),
  authenticationRequired: Boolean(form.authenticationRequired),
  whatsappIntegration: Boolean(form.whatsappIntegration),
  emailIntegration: Boolean(form.emailIntegration),
  thirdPartyIntegrations: form.thirdPartyIntegrations.trim(),
  hostingRequired: Boolean(form.hostingRequired),
  domainRequired: Boolean(form.domainRequired),
  maintenanceRequired: Boolean(form.maintenanceRequired),
  preferredTechnology: form.preferredTechnology.trim(),
  frontend: form.frontend.trim(),
  backend: form.backend.trim(),
  database: form.database.trim(),
  apiRequirements: form.apiRequirements.trim(),
  hostingDeploymentRequirements: form.hostingDeploymentRequirements.trim(),
  otherTechnicalRequirements: form.otherTechnicalRequirements.trim(),
  clientBudget: Math.max(0, Number(form.clientBudget) || 0),
  expectedStartDate: form.expectedStartDate ? new Date(form.expectedStartDate).toISOString() : null,
  expectedDeliveryDate: form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate).toISOString() : null,
  priority: form.priority || "medium",
  estimatedDevelopmentCost: Math.max(0, Number(form.estimatedDevelopmentCost) || 0),
  estimatedMaintenanceCost: Math.max(0, Number(form.estimatedMaintenanceCost) || 0),
  clientExpectations: form.clientExpectations.trim(),
  referenceWebsites: form.referenceWebsites.trim(),
  competitorWebsites: form.competitorWebsites.trim(),
  designPreferences: form.designPreferences.trim(),
  specialInstructions: form.specialInstructions.trim(),
  internalNotes: form.internalNotes.trim(),
});

export default function RequirementFormModal({ open, onClose, contact, requirement, onSaved }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isEdit = Boolean(requirement?._id);

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savingToQuote, setSavingToQuote] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (requirement) {
      setForm({
        ...EMPTY,
        ...requirement,
        socialMediaLinks: (requirement.socialMediaLinks || []).length ? requirement.socialMediaLinks : [""],
        numberOfPages: requirement.numberOfPages ?? "",
        numberOfProducts: requirement.numberOfProducts ?? "",
        clientBudget: requirement.clientBudget ?? "",
        estimatedDevelopmentCost: requirement.estimatedDevelopmentCost ?? "",
        estimatedMaintenanceCost: requirement.estimatedMaintenanceCost ?? "",
        expectedStartDate: toDateInput(requirement.expectedStartDate),
        expectedDeliveryDate: toDateInput(requirement.expectedDeliveryDate),
      });
    } else {
      setForm({
        ...EMPTY,
        businessName: contact?.businessName || "",
        clientName: contact?.contactPerson || "",
        mobileNumber: contact?.mobileNumber || "",
        email: contact?.email || "",
        location: contact?.location || "",
        existingWebsite: contact?.websiteLink || "",
      });
    }
  }, [open, requirement, contact]);

  const set = (key) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setBool = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const setLink = (i) => (e) => {
    const next = [...(form.socialMediaLinks || [])];
    next[i] = e.target.value;
    setForm((f) => ({ ...f, socialMediaLinks: next }));
  };

  const removeLink = (i) => {
    const next = [...(form.socialMediaLinks || [])];
    next.splice(i, 1);
    setForm((f) => ({ ...f, socialMediaLinks: next.length ? next : [""] }));
  };

  const addLink = () => setForm((f) => ({ ...f, socialMediaLinks: [...(f.socialMediaLinks || []), ""] }));

  const estimate = useMemo(
    () => Math.max(0, Number(form.estimatedDevelopmentCost) || 0) + Math.max(0, Number(form.estimatedMaintenanceCost) || 0),
    [form.estimatedDevelopmentCost, form.estimatedMaintenanceCost]
  );

  const validate = (asQuotation) => {
    if (asQuotation && !form.projectType) {
      toast.error("Select a Project Type before moving to quotation");
      return false;
    }
    if (asQuotation && !form.projectName.trim()) {
      toast.error("Enter a Project Name before moving to quotation");
      return false;
    }
    return true;
  };

  const persist = async (status, thenNavigate = false) => {
    const payload = normalizeForSave(form, contact);
    try {
      let id = requirement?._id;
      if (isEdit) {
        await adminPut(`/requirements/${id}`, { ...payload, status });
      } else {
        const res = await adminPost("/requirements", { ...payload, status });
        id = res.data?._id || id;
      }
      toast.ok(status === "ready_for_quotation" ? "Requirement marked ready for quotation" : "Requirement saved");
      if (thenNavigate && id) {
        onClose();
        navigate(`/admin/quotations/create?requirementId=${id}`);
      } else {
        onSaved?.(id);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saveDraft = async () => {
    if (!validate(false)) return;
    setSaving(true);
    try {
      await persist(requirement?.status || "collected", false);
    } finally {
      setSaving(false);
    }
  };

  const saveToQuotation = async () => {
    if (!validate(true)) return;
    setSavingToQuote(true);
    try {
      await persist("ready_for_quotation", true);
    } finally {
      setSavingToQuote(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm">
      <div className="mt-4 w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              {isEdit ? "Edit Requirement" : "Collect Requirement"}
            </h3>
            <p className="text-xs text-ink/50">
              {contact?.businessName} · {formatMobileNumber(contact?.mobileNumber)}
            </p>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <div className="mb-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
            {[
              [FaUser, "Client Details"],
              [FaProjectDiagram, "Project Details"],
              [FaListCheck, "Features"],
              [FaCode, "Technical"],
              [FaCoins, "Budget & Timeline"],
              [FaClipboardList, "Additional"],
            ].map(([Icon, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-base bg-base/40 px-3 py-1 text-ink/50">
                <Icon className="h-3 w-3 text-primary" /> {label}
              </span>
            ))}
          </div>

          <div className="space-y-6">
            {/* Client Details */}
            <Section icon={<FaUser />} title="Client Details" hint="Pre-filled from the contact - edit if needed">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business Name">
                  <Input value={form.businessName} onChange={set("businessName")} placeholder="Business name" />
                </Field>
                <Field label="Client / Contact Person">
                  <Input value={form.clientName} onChange={set("clientName")} placeholder="Contact person" />
                </Field>
                <Field label="Mobile Number">
                  <Input value={form.mobileNumber} onChange={set("mobileNumber")} placeholder="98765 43210" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="client@business.com" />
                </Field>
                <Field label="Location">
                  <Input value={form.location} onChange={set("location")} placeholder="City / area" />
                </Field>
                <Field label="Existing Website">
                  <Input value={form.existingWebsite} onChange={set("existingWebsite")} placeholder="https://..." />
                </Field>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink/70">Social Media Links</span>
                  <Button size="sm" variant="secondary" type="button" onClick={addLink}>
                    <FaPlus className="h-3 w-3" /> Add link
                  </Button>
                </div>
                <div className="space-y-2">
                  {(form.socialMediaLinks || []).map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={link} onChange={setLink(i)} placeholder="https://facebook.com/..." />
                      {(form.socialMediaLinks || []).length > 1 && (
                        <button type="button" onClick={() => removeLink(i)} className="shrink-0 rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100" title="Remove">
                          <FaTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* Project Details */}
            <Section icon={<FaProjectDiagram />} title="Project Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project Type">
                  <Select value={form.projectType} onChange={set("projectType")} options={PROJECT_TYPES.map((p) => ({ value: p, label: p }))} placeholder="Select project type" />
                </Field>
                <Field label="Project Name">
                  <Input value={form.projectName} onChange={set("projectName")} placeholder="e.g. Restaurant Website with Online Ordering" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Business Description">
                    <Textarea rows={2} value={form.businessDescription} onChange={set("businessDescription")} placeholder="Describe the client's business" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Project Description">
                    <Textarea rows={3} value={form.projectDescription} onChange={set("projectDescription")} placeholder="Scope, goals and deliverables" />
                  </Field>
                </div>
                <Field label="Main Objective">
                  <Input value={form.mainObjective} onChange={set("mainObjective")} placeholder="Primary goal of the project" />
                </Field>
                <Field label="Target Audience">
                  <Input value={form.targetAudience} onChange={set("targetAudience")} placeholder="Who is this for?" />
                </Field>
                <Field label="Number of Pages">
                  <Input type="number" min="0" value={form.numberOfPages} onChange={set("numberOfPages")} placeholder="e.g. 5" />
                </Field>
                <Field label="Number of Products / Services">
                  <Input type="number" min="0" value={form.numberOfProducts} onChange={set("numberOfProducts")} placeholder="e.g. 50" />
                </Field>
              </div>
            </Section>

            {/* Features */}
            <Section icon={<FaListCheck />} title="Required Features">
              <Field label="Required Features" hint="List must-have functionality, one per line">
                <Textarea rows={4} value={form.requiredFeatures} onChange={set("requiredFeatures")} placeholder={"Online ordering\nPayment gateway\nUser dashboard..."} />
              </Field>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BOOL_FIELDS.map(([key, label]) => (
                  <div key={key} className="rounded-xl border border-base bg-base/40 px-3 py-2.5">
                    <Switch checked={Boolean(form[key])} onChange={setBool(key)} label={label} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Field label="Third-party Integrations" hint="e.g. Razorpay, WhatsApp Business API, Google Maps">
                  <Input value={form.thirdPartyIntegrations} onChange={set("thirdPartyIntegrations")} placeholder="Comma separated integrations" />
                </Field>
              </div>
            </Section>

            {/* Technical Requirements */}
            <Section icon={<FaCode />} title="Technical Requirements">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred Technology">
                  <Input value={form.preferredTechnology} onChange={set("preferredTechnology")} placeholder="e.g. MERN, Laravel, Flutter" />
                </Field>
                <Field label="Frontend">
                  <Input value={form.frontend} onChange={set("frontend")} placeholder="e.g. React, Vue" />
                </Field>
                <Field label="Backend">
                  <Input value={form.backend} onChange={set("backend")} placeholder="e.g. Node.js, Django" />
                </Field>
                <Field label="Database">
                  <Input value={form.database} onChange={set("database")} placeholder="e.g. MongoDB, PostgreSQL" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="API Requirements">
                    <Input value={form.apiRequirements} onChange={set("apiRequirements")} placeholder="Any external APIs to integrate" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Hosting / Deployment Requirements">
                    <Input value={form.hostingDeploymentRequirements} onChange={set("hostingDeploymentRequirements")} placeholder="Preferred hosting, CI/CD needs" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Other Technical Requirements">
                    <Textarea rows={2} value={form.otherTechnicalRequirements} onChange={set("otherTechnicalRequirements")} placeholder="Anything else technical" />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Budget & Timeline */}
            <Section icon={<FaCoins />} title="Budget & Timeline">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client Budget (Rs.)">
                  <Input type="number" min="0" value={form.clientBudget} onChange={set("clientBudget")} placeholder="e.g. 80000" />
                </Field>
                <Field label="Priority">
                  <Select value={form.priority} onChange={set("priority")} options={REQUIREMENT_PRIORITIES} placeholder={false} />
                </Field>
                <Field label="Expected Start Date">
                  <Input type="date" value={form.expectedStartDate} onChange={set("expectedStartDate")} />
                </Field>
                <Field label="Expected Delivery Date">
                  <Input type="date" value={form.expectedDeliveryDate} onChange={set("expectedDeliveryDate")} />
                </Field>
                <Field label="Estimated Development Cost (Rs.)">
                  <Input type="number" min="0" value={form.estimatedDevelopmentCost} onChange={set("estimatedDevelopmentCost")} placeholder="e.g. 25000" />
                </Field>
                <Field label="Estimated Maintenance Cost (Rs.)">
                  <Input type="number" min="0" value={form.estimatedMaintenanceCost} onChange={set("estimatedMaintenanceCost")} placeholder="e.g. 3000" />
                </Field>
              </div>
              {estimate > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-4 py-2.5 text-sm">
                  <span className="text-ink/60">Estimated project value</span>
                  <span className="font-bold text-primary">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(estimate)}
                  </span>
                </div>
              )}
            </Section>

            {/* Additional Information */}
            <Section icon={<FaClipboardList />} title="Additional Information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client Expectations">
                  <Textarea rows={2} value={form.clientExpectations} onChange={set("clientExpectations")} placeholder="What the client expects from this project" />
                </Field>
                <Field label="Design Preferences">
                  <Textarea rows={2} value={form.designPreferences} onChange={set("designPreferences")} placeholder="Colors, style, mood" />
                </Field>
                <Field label="Reference Websites" hint="Sites the client likes">
                  <Input value={form.referenceWebsites} onChange={set("referenceWebsites")} placeholder="https://..." />
                </Field>
                <Field label="Competitor Websites">
                  <Input value={form.competitorWebsites} onChange={set("competitorWebsites")} placeholder="https://..." />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Special Instructions">
                    <Textarea rows={2} value={form.specialInstructions} onChange={set("specialInstructions")} placeholder="Anything the team must know" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Internal Notes" hint="Only visible to the Skyntrix team">
                    <Textarea rows={2} value={form.internalNotes} onChange={set("internalNotes")} placeholder="Internal commentary" />
                  </Field>
                </div>
              </div>
            </Section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={saveDraft} loading={saving}>
            <FaSave className="h-3.5 w-3.5" /> Save Requirement
          </Button>
          <Button onClick={saveToQuotation} loading={savingToQuote}>
            <FaFileInvoiceDollar className="h-3.5 w-3.5" /> Save & Move to Quotation
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, hint, children }) {
  return (
    <div className="rounded-2xl border border-base bg-white p-5">
      <h4 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink/60">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-gradient text-white">{icon}</span>
        {title}
      </h4>
      {hint && <p className="mb-4 -mt-2 text-xs text-ink/40">{hint}</p>}
      {children}
    </div>
  );
}
