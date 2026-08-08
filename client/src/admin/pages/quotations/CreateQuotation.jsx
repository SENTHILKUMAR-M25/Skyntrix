import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { FaArrowLeft, FaSave, FaWhatsapp, FaUndoAlt, FaPlus, FaTrash } from "react-icons/fa";
import { adminGet, adminPost, adminPut } from "../../api";
import { useToast } from "../../Toast";
import { Button, Field, Input, Loading, PageHeader, Textarea } from "../../components/Ui";
import QuotationPreviewModal from "../../components/quotations/QuotationPreviewModal";
import {
  formatMoney,
  isValidMobileNumber,
  normalizeMobileNumber,
  quoteServicesTotal,
} from "../../utils/quotation";

const DEFAULT_VALUES = {
  clientName: "",
  businessName: "",
  mobile: "",
  email: "",
  projectName: "",
  projectDescription: "",
  services: [{ name: "", description: "", amount: "" }],
  projectTimeline: "",
  paymentTerms: "",
  advanceAmount: "",
  totalAmount: "",
  additionalNotes: "",
  validUntil: "",
};

export default function CreateQuotation() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("leadId") || "";
  const requirementId = searchParams.get("requirementId") || "";
  const contactId = searchParams.get("contactId") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, reset, control, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "services" });

  const [loading, setLoading] = useState(isEdit || Boolean(leadId) || Boolean(requirementId) || Boolean(contactId));
  const [preview, setPreview] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [sending, setSending] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState("");

  const services = watch("services") || [];
  const watched = watch();
  const totalFromItems = quoteServicesTotal(services);
  const showTotalField = services.length === 0 || services.every((s) => !String(s.amount || "").trim());

  // Prefill from a lead when launched from the pipeline profile.
  useEffect(() => {
    if (!leadId || isEdit) return;
    (async () => {
      try {
        const res = await adminGet(`/leads/admin/${leadId}`);
        const d = res.data || {};
        reset((current) => ({
          ...current,
          clientName: d.name || "",
          businessName: d.company || "",
          mobile: d.phone ? (normalizeMobileNumber(d.phone)?.slice(2) || d.phone) : "",
          email: d.email || "",
          projectName: d.service ? `${d.service} project` : "",
        }));
        toast.info("Lead details pre-filled");
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [leadId, isEdit, reset, toast]);

  // Prefill from a collected requirement (client + project + suggested line items).
  useEffect(() => {
    if (!requirementId || isEdit) return;
    (async () => {
      try {
        const res = await adminGet(`/requirements/${requirementId}`);
        const d = res.data || {};
        const services = [];
        if (Number(d.estimatedDevelopmentCost) > 0) {
          services.push({ name: "Development", description: d.projectType || "Development", amount: Number(d.estimatedDevelopmentCost) });
        }
        if (Number(d.estimatedMaintenanceCost) > 0) {
          services.push({ name: "Maintenance & Support", description: "Maintenance and support", amount: Number(d.estimatedMaintenanceCost) });
        }
        reset((current) => ({
          ...current,
          clientName: d.clientName || "",
          businessName: d.businessName || "",
          mobile: d.mobileNumber ? (normalizeMobileNumber(d.mobileNumber)?.slice(2) || d.mobileNumber) : "",
          email: d.email || "",
          projectName: d.projectName || d.projectType || "",
          projectDescription: d.projectDescription || d.businessDescription || "",
          services: services.length ? services : current.services,
        }));
        setPrefillNotice(`Requirement pre-filled (${d.projectName || d.projectType || "collected requirement"})`);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [requirementId, isEdit, reset, toast]);

  // Prefill client details from a lead contact (no requirement linked yet).
  useEffect(() => {
    if (!contactId || isEdit || requirementId) return;
    (async () => {
      try {
        const res = await adminGet(`/lead-contacts/${contactId}`);
        const d = res.data || {};
        reset((current) => ({
          ...current,
          clientName: d.contactPerson || d.businessName || "",
          businessName: d.businessName || "",
          mobile: d.mobileNumber ? (normalizeMobileNumber(d.mobileNumber)?.slice(2) || d.mobileNumber) : "",
          email: d.email || "",
        }));
        setPrefillNotice(`Contact details pre-filled for ${d.businessName || "the client"}`);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId, isEdit, requirementId, reset, toast]);

  // Load existing quotation in edit mode.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await adminGet(`/quotations/${id}`);
        const d = res.data || {};
        reset({
          clientName: d.clientName || "",
          businessName: d.businessName || "",
          mobile: d.mobile ? normalizeMobileNumber(d.mobile)?.slice(2) || d.mobile : "",
          email: d.email || "",
          projectName: d.projectName || "",
          projectDescription: d.projectDescription || "",
          services: (d.services || []).length ? d.services.map((s) => ({ name: s.name || "", description: s.description || "", amount: s.amount ?? "" })) : DEFAULT_VALUES.services,
          projectTimeline: d.projectTimeline || "",
          paymentTerms: d.paymentTerms || "",
          advanceAmount: d.advanceAmount ?? "",
          totalAmount: d.totalAmount ?? "",
          additionalNotes: d.additionalNotes || "",
          validUntil: d.validUntil ? new Date(d.validUntil).toISOString().slice(0, 10) : "",
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id, reset, toast]);

  const previewQuotation = useMemo(
    () => ({
      clientName: watched.clientName || "",
      mobile: normalizeMobileNumber(watched.mobile) || watched.mobile || "",
      quotationNumber: "",
      pdfUrl: "",
    }),
    [watched]
  );

  const buildPayload = (values) => ({
    leadId: leadId || undefined,
    requirementId: requirementId || undefined,
    contactId: contactId || undefined,
    clientName: values.clientName.trim(),
    businessName: values.businessName.trim() || undefined,
    mobile: normalizeMobileNumber(values.mobile) || values.mobile,
    email: values.email.trim() || undefined,
    projectName: values.projectName.trim(),
    projectDescription: values.projectDescription.trim() || undefined,
    services: values.services
      .filter((s) => String(s.name || "").trim())
      .map((s) => ({
        name: s.name.trim(),
        description: String(s.description || "").trim(),
        amount: Math.max(0, Number(s.amount) || 0),
      })),
    projectTimeline: values.projectTimeline.trim() || undefined,
    paymentTerms: values.paymentTerms.trim() || undefined,
    advanceAmount: Math.max(0, Number(values.advanceAmount) || 0),
    totalAmount: values.services.some((s) => String(s.name || "").trim())
      ? quoteServicesTotal(values.services)
      : Math.max(0, Number(values.totalAmount) || 0),
    additionalNotes: values.additionalNotes.trim() || undefined,
    validUntil: values.validUntil ? new Date(values.validUntil).toISOString() : undefined,
  });

  const onError = (errs) => {
    const first = Object.values(errs)[0];
    toast.error(first?.message || "Please fix the highlighted fields");
  };

  const saveAsDraft = async (values) => {
    const payload = buildPayload(values);
    try {
      if (isEdit) {
        await adminPut(`/quotations/${id}`, payload);
        toast.ok("Quotation updated");
      } else {
        const res = await adminPost("/quotations", payload);
        toast.ok(`Draft saved - Quotation ${res.data?.quotationNumber || ""} created`);
      }
      navigate("/admin/quotations");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openSendPreview = () => {
    handleSubmit((values) => {
      setPendingPayload(buildPayload(values));
      setPreview(true);
    }, onError)();
  };

  const doSend = async () => {
    if (!pendingPayload) return;
    setSending(true);
    try {
      const res = isEdit
        ? await adminPost("/quotations/send", { ...pendingPayload, quotationId: id })
        : await adminPost("/quotations/send", pendingPayload);
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok("Quotation sent on WhatsApp");
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Quotation send failed");
      }
      setPreview(false);
      navigate("/admin/quotations");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading label="Loading quotation..." />;

  return (
    <div>
      <button onClick={() => navigate("/admin/quotations")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to quotations
      </button>

      <PageHeader
        title={isEdit ? "Edit Quotation" : "Create Quotation"}
        subtitle="Fill in the details, generate a branded PDF and send it on WhatsApp."
      />

      {prefillNotice && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-ink/70">
          <span>{prefillNotice}</span>
          <button type="button" onClick={() => setPrefillNotice("")} className="text-ink/40 transition-colors hover:text-ink" aria-label="Dismiss">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit(saveAsDraft)} className="max-w-5xl space-y-6">
        {/* Client details */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Client details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client Name" required error={errors.clientName?.message}>
              <Input
                placeholder="e.g. Mr. Arun Kumar"
                {...register("clientName", {
                  required: "Client name is required",
                  maxLength: { value: 200, message: "Client name must be 200 characters or fewer" },
                })}
              />
            </Field>
            <Field label="Business Name" error={errors.businessName?.message}>
              <Input
                placeholder="e.g. Cafe Madurai"
                {...register("businessName", { maxLength: { value: 200, message: "Business name must be 200 characters or fewer" } })}
              />
            </Field>
            <Field label="Mobile Number" required error={errors.mobile?.message} hint="Indian mobile number - e.g. 98765 43210">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">+91</span>
                <Input
                  className="pl-11"
                  placeholder="98765 43210"
                  {...register("mobile", {
                    required: "Mobile number is required",
                    validate: (v) => isValidMobileNumber(v) || "Enter a valid mobile number",
                  })}
                />
              </div>
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input
                type="email"
                placeholder="client@business.com"
                {...register("email", {
                  pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address" },
                })}
              />
            </Field>
          </div>
        </div>

        {/* Project details */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Project details</h2>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project Name" required error={errors.projectName?.message}>
                <Input
                  placeholder="e.g. Restaurant Website with Online Ordering"
                  {...register("projectName", {
                    required: "Project name is required",
                    maxLength: { value: 200, message: "Project name must be 200 characters or fewer" },
                  })}
                />
              </Field>
              <Field label="Project Timeline" error={errors.projectTimeline?.message} hint="e.g. 3-4 weeks">
                <Input placeholder="3-4 weeks" {...register("projectTimeline")} />
              </Field>
            </div>
            <Field label="Project Description" error={errors.projectDescription?.message}>
              <Textarea
                rows={3}
                placeholder="Describe the project scope, goals and deliverables..."
                {...register("projectDescription", { maxLength: { value: 5000, message: "Project description must be 5000 characters or fewer" } })}
              />
            </Field>
          </div>
        </div>

        {/* Selected services */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Selected Services</h2>
            <Button size="sm" variant="secondary" type="button" onClick={() => append({ name: "", description: "", amount: "" })}>
              <FaPlus className="h-3 w-3" /> Add service
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded-xl bg-base/60 px-4 py-6 text-center text-sm text-ink/40">
              No services added yet. Add line items or enter the total amount manually below.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={field.id} className="grid gap-3 rounded-xl border border-base bg-base/40 p-3 sm:grid-cols-[1fr_1.5fr_140px_auto]">
                  <Field label={i === 0 ? "Service" : ""} error={errors.services?.[i]?.name?.message}>
                    <Input
                      placeholder="e.g. Website Design"
                      {...register(`services.${i}.name`, { required: "Service name is required" })}
                    />
                  </Field>
                  <Field label={i === 0 ? "Description" : ""}>
                    <Input
                      placeholder="e.g. 5-page responsive design with wireframes"
                      {...register(`services.${i}.description`)}
                    />
                  </Field>
                  <Field label={i === 0 ? "Amount (Rs.)" : ""}>
                    <Input
                      type="number"
                      min="0"
                      placeholder="25000"
                      {...register(`services.${i}.amount`)}
                    />
                  </Field>
                  <div className="flex items-end justify-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                      title="Remove service"
                    >
                      <FaTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-64">
              <Field label="Advance Amount (Rs.)">
                <Input type="number" min="0" placeholder="40000" {...register("advanceAmount")} />
              </Field>
            </div>
            {showTotalField ? (
              <div className="w-full sm:w-64">
                <Field label="Total Amount (Rs.)" required error={errors.totalAmount?.message} hint="Used when no line items are added">
                  <Input
                    type="number"
                    min="0"
                    placeholder="80000"
                    {...register("totalAmount", {
                      validate: (v) =>
                        services.some((s) => String(s.name || "").trim())
                          ? true
                          : (v !== "" && Number(v) >= 0) || "Total amount is required when no services are listed",
                    })}
                  />
                </Field>
              </div>
            ) : (
              <div className="rounded-xl bg-primary/5 px-4 py-2.5 text-sm">
                <span className="text-ink/50">Calculated total </span>
                <span className="font-bold text-primary">{formatMoney(totalFromItems)}</span>
              </div>
            )}
            <div className="ml-auto">
              <div className="rounded-xl bg-base/60 px-4 py-2.5 text-sm">
                <span className="text-ink/50">Sum of items </span>
                <span className="font-bold text-ink">{formatMoney(totalFromItems)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & terms */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Payment & terms</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment Terms" error={errors.paymentTerms?.message} hint="e.g. 50% advance, 50% on delivery">
              <Textarea rows={2} placeholder="50% advance, 50% on delivery" {...register("paymentTerms", { maxLength: { value: 1000, message: "Payment terms must be 1000 characters or fewer" } })} />
            </Field>
            <div className="space-y-4">
              <Field label="Valid Until" error={errors.validUntil?.message}>
                <Input type="date" {...register("validUntil")} />
              </Field>
              <Field label="Additional Notes" error={errors.additionalNotes?.message}>
                <Textarea rows={2} placeholder="Optional notes, inclusions or exclusions..." {...register("additionalNotes", { maxLength: { value: 3000, message: "Additional notes must be 3000 characters or fewer" } })} />
              </Field>
            </div>
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
          <Button type="button" className="bg-[#25D366] hover:bg-[#1fb959]" onClick={openSendPreview}>
            <FaWhatsapp /> Send Quotation
          </Button>
        </div>
      </form>

      <QuotationPreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        quotation={previewQuotation}
        onSend={doSend}
        sending={sending}
      />
    </div>
  );
}
