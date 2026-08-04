import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave, FaEye, FaWhatsapp, FaUndoAlt, FaUserCheck } from "react-icons/fa";
import { adminGet, adminPost, adminPut } from "../../api";
import { useToast } from "../../Toast";
import { Button, Field, Input, Loading, PageHeader, Select, Textarea } from "../../components/Ui";
import WhatsAppPreviewModal from "../../components/lead-contacts/WhatsAppPreviewModal";
import { FOLLOW_UP_OPTIONS, ensureProtocol, isValidMobileNumber, isValidUrl } from "../../utils/leadContact";

const DEFAULT_VALUES = {
  businessName: "",
  mobileNumber: "",
  summary: "",
  demoLink: "",
  websiteLink: "",
  notes: "",
  tags: "",
  followUpStatus: "none",
  nextFollowUpAt: "",
  assignedTo: "",
};

const normalizePayload = (values) => ({
  ...values,
  demoLink: values.demoLink ? ensureProtocol(values.demoLink) : "",
  websiteLink: values.websiteLink ? ensureProtocol(values.websiteLink) : "",
  tags: String(values.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10),
  nextFollowUpAt: values.nextFollowUpAt ? new Date(values.nextFollowUpAt).toISOString() : "",
  assignedTo: values.assignedTo || undefined,
});

export default function CreateLead() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const [loading, setLoading] = useState(isEdit);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [employees, setEmployees] = useState([]);

  const watched = watch();

  // Load lead in edit mode
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await adminGet(`/lead-contacts/${id}`);
        const d = res.data || {};
        reset({
          businessName: d.businessName || "",
          mobileNumber: d.mobileNumber || "",
          summary: d.summary || "",
          demoLink: d.demoLink || "",
          websiteLink: d.websiteLink || "",
          notes: d.notes || "",
          tags: (d.tags || []).join(", "),
          followUpStatus: d.followUpStatus || "none",
          nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt).toISOString().slice(0, 10) : "",
          assignedTo: d.assignedTo || "",
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id, reset, toast]);

  // Load employee list (best effort - falls back to current user)
  useEffect(() => {
    adminGet("/auth/admins")
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
  }, []);

  const previewLead = useMemo(
    () => ({
      businessName: watched.businessName,
      mobileNumber: watched.mobileNumber,
      summary: watched.summary,
      demoLink: watched.demoLink ? ensureProtocol(watched.demoLink) : "",
      websiteLink: watched.websiteLink ? ensureProtocol(watched.websiteLink) : "",
    }),
    [watched]
  );

  const saveAsDraft = async (data) => {
    const payload = normalizePayload(data);
    try {
      if (isEdit) {
        await adminPut(`/lead-contacts/${id}`, payload);
        toast.ok("Lead updated");
      } else {
        await adminPost("/lead-contacts", payload);
        toast.ok("Draft saved - Lead created successfully");
      }
      navigate("/admin/lead-contacts");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openPreview = () => {
    handleSubmit(
      () => setPreview(previewLead),
      (errs) => {
        const first = Object.values(errs)[0];
        toast.error(first?.message || "Please fix the highlighted fields");
      }
    )();
  };

  const sendNow = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const payload = normalizePayload(previewLead);
      const res = isEdit
        ? await adminPost("/lead-contacts/send-whatsapp", { ...payload, leadId: id })
        : await adminPost("/lead-contacts/send-whatsapp", payload);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("WhatsApp sent successfully");
      } else {
        toast.error("WhatsApp send failed");
      }
      setPreview(null);
      navigate("/admin/lead-contacts");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading label="Loading lead..." />;

  return (
    <div>
      <button onClick={() => navigate("/admin/lead-contacts")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to leads
      </button>

      <PageHeader
        title={isEdit ? "Edit Lead Contact" : "Create Lead Contact"}
        subtitle="Enter business details, preview the message and send it on WhatsApp."
      />

      <form onSubmit={handleSubmit(saveAsDraft)} className="max-w-4xl space-y-6">
        {/* Business details */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Business details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business Name" required error={errors.businessName?.message}>
              <Input
                placeholder="e.g. Cafe Madurai"
                {...register("businessName", {
                  required: "Business name is required",
                  maxLength: { value: 200, message: "Business name must be 200 characters or fewer" },
                })}
              />
            </Field>
            <Field label="Mobile Number" required error={errors.mobileNumber?.message} hint="Indian mobile number - e.g. 98765 43210">
              <Input
                placeholder="98765 43210"
                {...register("mobileNumber", {
                  required: "Mobile number is required",
                  validate: (v) => isValidMobileNumber(v) || "Enter a valid mobile number",
                })}
              />
            </Field>
            <Field label="Summary" required error={errors.summary?.message} hint="Short description of what the business needs">
              <Textarea
                rows={3}
                placeholder="e.g. Restaurant looking for a website with online ordering and a table booking system."
                {...register("summary", {
                  required: "Summary is required",
                  maxLength: { value: 2000, message: "Summary must be 2000 characters or fewer" },
                })}
              />
            </Field>
            <div className="space-y-4">
              <Field label="Demo Link" error={errors.demoLink?.message} hint="Optional - a live demo or sample link">
                <Input
                  placeholder="https://demo.example.com"
                  {...register("demoLink", {
                    validate: (v) => !v || isValidUrl(v) || "Demo link must be a valid URL",
                  })}
                />
              </Field>
              <Field label="Website Link" error={errors.websiteLink?.message} hint="Optional - the business website">
                <Input
                  placeholder="https://business.com"
                  {...register("websiteLink", {
                    validate: (v) => !v || isValidUrl(v) || "Website link must be a valid URL",
                  })}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Follow-up & assignment */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Follow-up & assignment</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Follow-up status">
              <Select options={FOLLOW_UP_OPTIONS} placeholder={false} {...register("followUpStatus")} />
            </Field>
            <Field label="Next follow-up date">
              <Input type="date" {...register("nextFollowUpAt")} />
            </Field>
            <Field label="Assigned employee">
              <div className="relative">
                <FaUserCheck className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <Select
                  className="pl-9"
                  placeholder={false}
                  options={[
                    ...employees.map((e) => ({ value: e._id, label: e.name })),
                    ...(employees.length === 0 ? [{ value: "", label: "Unassigned" }] : []),
                  ]}
                  {...register("assignedTo")}
                />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tags" hint="Comma separated, e.g. hotel, urgent, demo-requested">
                <Input placeholder="hotel, urgent" {...register("tags")} />
              </Field>
            </div>
            <Field label="Notes" hint="Internal notes for your team">
              <Input placeholder="e.g. Call back on Friday" {...register("notes")} />
            </Field>
          </div>
        </div>

        {/* Actions */}
        <div className="card flex flex-wrap items-center justify-end gap-3 p-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { reset(DEFAULT_VALUES); toast.info("Form reset"); }}
          >
            <FaUndoAlt /> Reset
          </Button>
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            <FaSave /> Save Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openPreview}
          >
            <FaEye /> Preview Message
          </Button>
          <Button
            type="button"
            className="bg-[#25D366] hover:bg-[#1fb959]"
            onClick={openPreview}
          >
            <FaWhatsapp /> Send WhatsApp
          </Button>
        </div>
      </form>

      <WhatsAppPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        lead={previewLead}
        onEdit={() => setPreview(null)}
        onSend={sendNow}
        sending={sending}
        title={isEdit ? "Preview & resend WhatsApp message" : "Preview WhatsApp message"}
      />
    </div>
  );
}
