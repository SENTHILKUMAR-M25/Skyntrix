import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { FaArrowLeft, FaSave, FaPaperPlane, FaUndoAlt, FaPlus, FaTrash, FaLink } from "react-icons/fa";
import { adminGet, adminPost, adminPut } from "../../api";
import { useToast } from "../../Toast";
import { Button, Field, Input, Loading, PageHeader, Select, Textarea } from "../../components/Ui";
import InvoicePreviewModal from "../../components/invoices/InvoicePreviewModal";
import {
  formatMoney,
  formatDate,
  isValidMobileNumber,
  normalizeMobileNumber,
  computeTotals,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
} from "../../utils/invoice";

const TODAY = () => new Date().toISOString().slice(0, 10);
const IN_15_DAYS = () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DEFAULT_VALUES = {
  quotationId: "",
  clientName: "",
  businessName: "",
  mobile: "",
  email: "",
  billingAddress: "",
  gstin: "",
  projectName: "",
  projectDescription: "",
  items: [{ name: "", description: "", quantity: "1", unitPrice: "" }],
  discount: "0",
  discountType: "flat",
  taxRate: "0",
  invoiceDate: TODAY(),
  dueDate: IN_15_DAYS(),
  paymentMethod: "bank_transfer",
  type: "full",
  notes: "",
  terms: "Payment due within 15 days.",
};

export default function CreateInvoice() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const quotationParam = searchParams.get("quotationId") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, reset, control, watch, getValues, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const [loading, setLoading] = useState(isEdit);
  const [quotations, setQuotations] = useState([]);
  const [prefill, setPrefill] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [channel, setChannel] = useState("whatsapp");
  const [sending, setSending] = useState(false);
  const [loadedInvoice, setLoadedInvoice] = useState(null);

  const items = watch("items") || [];
  const discount = watch("discount");
  const discountType = watch("discountType");
  const taxRate = watch("taxRate");
  const totals = computeTotals(items, discount, discountType, taxRate);

  // Load approved quotations for the picker.
  useEffect(() => {
    (async () => {
      try {
        const res = await adminGet("/quotations", { limit: 100, sort: "createdAt:desc" });
        setQuotations(res.data || []);
      } catch (e) {
        toast.error(e.message);
      }
    })();
  }, [toast]);

  // Load existing invoice in edit mode.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await adminGet(`/invoices/${id}`);
        const d = res.data || {};
        setLoadedInvoice(d);
        reset({
          quotationId: d.quotationId || "",
          clientName: d.clientName || "",
          businessName: d.businessName || "",
          mobile: d.mobile ? normalizeMobileNumber(d.mobile)?.slice(2) || d.mobile : "",
          email: d.email || "",
          billingAddress: d.billingAddress || "",
          gstin: d.gstin || "",
          projectName: d.projectName || "",
          projectDescription: d.projectDescription || "",
          items: (d.items || []).length
            ? d.items.map((it) => ({ name: it.name || "", description: it.description || "", quantity: String(it.quantity ?? 1), unitPrice: String(it.unitPrice ?? "") }))
            : DEFAULT_VALUES.items,
          discount: String(d.discount ?? 0),
          discountType: d.discountType || "flat",
          taxRate: String(d.taxRate ?? 0),
          invoiceDate: d.invoiceDate ? new Date(d.invoiceDate).toISOString().slice(0, 10) : TODAY(),
          dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : "",
          paymentMethod: d.paymentMethod || "bank_transfer",
          type: d.type || "full",
          notes: d.notes || "",
          terms: d.terms || "",
        });
        if (d.quotationId) {
          try {
            const p = await adminGet(`/invoices/prefill/${d.quotationId}`);
            setPrefill(p.data || null);
          } catch (e) {
            toast.error(e.message);
          }
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id, reset, toast]);

  const applyQuotation = async (quotationId) => {
    setValue("quotationId", quotationId);
    if (!quotationId) {
      setPrefill(null);
      return;
    }
    setPrefillLoading(true);
    try {
      const res = await adminGet(`/invoices/prefill/${quotationId}`);
      const data = res.data || {};
      setPrefill(data);
      const q = data.quotation || {};
      const summary = data.summary || {};
      const isFirstInvoice = (data.existing || []).length === 0;
      const current = getValues();
      const type = (isEdit ? current.type : data.suggestedTypes?.[0]) || "full";

      const servicesItems = (q.services || []).map((s) => ({
        name: s.name || "",
        description: s.description || "",
        quantity: "1",
        unitPrice: String(s.amount ?? ""),
      }));

      const available = Number(summary.availableForInvoice) || 0;
      const suggested = Math.min(Number(summary.remainingBalance) || 0, available);

      let itemsFrom;
      if (type === "full" && isFirstInvoice) {
        itemsFrom = servicesItems;
      } else {
        const amount = type === "advance" && Number(q.advanceAmount) > 0
          ? Math.min(Number(q.advanceAmount), suggested)
          : suggested;
        const name = type === "advance"
          ? "Advance Payment"
          : type === "partial"
            ? "Milestone Payment"
            : type === "final"
              ? "Final Payment"
              : "Project Payment";
        itemsFrom = [{ name, description: "", quantity: "1", unitPrice: String(Math.max(0, amount)) }];
      }

      reset({
        ...current,
        clientName: q.clientName || "",
        businessName: q.businessName || "",
        mobile: q.mobile ? normalizeMobileNumber(q.mobile)?.slice(2) || q.mobile : "",
        email: q.email || "",
        billingAddress: q.billingAddress || "",
        gstin: q.gstin || "",
        projectName: q.projectName || "",
        projectDescription: q.projectDescription || "",
        items: itemsFrom.length ? itemsFrom : current.items,
        terms: q.paymentTerms || current.terms,
        type,
      });
      toast.ok(`Quotation ${q.quotationNumber || ""} loaded`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPrefillLoading(false);
    }
  };

  // Auto-load a quotation passed in the URL (?quotationId=...) from a lead profile.
  useEffect(() => {
    if (!quotationParam || isEdit) return;
    setValue("quotationId", quotationParam);
    applyQuotation(quotationParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationParam]);

  const buildPayload = (values) => ({
    quotationId: values.quotationId || undefined,
    clientName: values.clientName.trim(),
    businessName: values.businessName.trim() || undefined,
    mobile: normalizeMobileNumber(values.mobile) || values.mobile,
    email: values.email.trim() || undefined,
    billingAddress: values.billingAddress.trim() || undefined,
    gstin: values.gstin.trim().toUpperCase() || undefined,
    projectName: values.projectName.trim(),
    projectDescription: values.projectDescription.trim() || undefined,
    items: (values.items || [])
      .filter((it) => String(it.name || "").trim())
      .map((it) => ({
        name: it.name.trim(),
        description: String(it.description || "").trim(),
        quantity: Math.max(0, Number(it.quantity) || 0),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      })),
    discount: Math.max(0, Number(values.discount) || 0),
    discountType: values.discountType || "flat",
    taxRate: Math.max(0, Math.min(100, Number(values.taxRate) || 0)),
    invoiceDate: values.invoiceDate ? new Date(values.invoiceDate).toISOString() : undefined,
    dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
    paymentMethod: values.paymentMethod || "bank_transfer",
    type: values.type || "full",
    notes: values.notes.trim() || undefined,
    terms: values.terms.trim() || undefined,
  });

  const onError = (errs) => {
    const first = Object.values(errs)[0];
    toast.error(first?.message || "Please fix the highlighted fields");
  };

  /** Reject amounts that would exceed the project's remaining billable balance. */
  const availableToInvoice = !prefill?.summary?.projectTotal
    ? null
    : (Number(prefill.summary.availableForInvoice) || 0) + (isEdit && loadedInvoice ? Number(loadedInvoice.totalAmount) || 0 : 0);

  const balanceError = (amount) => {
    if (availableToInvoice == null) return "";
    if (amount > availableToInvoice + 0.001) {
      return `Invoice amount (${formatMoney(amount)}) exceeds the remaining balance (${formatMoney(availableToInvoice)}) for this quotation.`;
    }
    if (availableToInvoice <= 0) {
      return "No remaining balance to invoice - this project is already fully invoiced.";
    }
    return "";
  };

  const saveAsDraft = async (values) => {
    const payload = buildPayload(values);
    const err = balanceError(totals.totalAmount);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      if (isEdit) {
        await adminPut(`/invoices/${id}`, payload);
        toast.ok("Invoice updated");
      } else {
        const res = await adminPost("/invoices", payload);
        toast.ok(`Invoice ${res.data?.invoiceNumber || ""} created`);
      }
      navigate("/admin/invoices");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openSendPreview = () => {
    handleSubmit((values) => {
      const err = balanceError(totals.totalAmount);
      if (err) {
        toast.error(err);
        return;
      }
      const payload = buildPayload(values);
      const { totalAmount } = computeTotals(payload.items || [], payload.discount, payload.discountType, payload.taxRate);
      const amountPaid = loadedInvoice?.amountPaid ? Math.max(0, Math.min(Number(loadedInvoice.amountPaid) || 0, totalAmount)) : 0;
      setPendingPayload({ ...payload, totalAmount, amountPaid, balanceDue: Math.max(0, totalAmount - amountPaid) });
      setPreview(true);
    }, onError)();
  };

  const doSend = async () => {
    if (!pendingPayload) return;
    setSending(true);
    try {
      const res = isEdit
        ? await adminPost(`/invoices/${id}/resend`, { ...pendingPayload, channel, invoiceId: id })
        : await adminPost("/invoices/send", { ...pendingPayload, channel });
      const data = res.data || {};
      if (data.status === "fallback" && data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener");
        toast.info("WhatsApp Web opened - Cloud API not configured");
      } else if (data.status === "success") {
        toast.ok(data.message || "Invoice sent");
      } else if (data.status === "template") {
        toast.info("Template sent - the PDF will be delivered automatically when the client replies");
      } else {
        toast.error(data.message || data.error || "Invoice send failed");
      }
      setPreview(false);
      navigate("/admin/invoices");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading label="Loading invoice..." />;

  const usedTypes = (prefill?.existing || []).map((inv) => inv.type);

  return (
    <div>
      <button onClick={() => navigate("/admin/invoices")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-primary">
        <FaArrowLeft /> Back to invoices
      </button>

      <PageHeader
        title={isEdit ? "Edit Invoice" : "Create Invoice"}
        subtitle="Generate a branded PDF invoice from a quotation or as a blank invoice."
      />

      <form onSubmit={handleSubmit(saveAsDraft)} className="max-w-5xl space-y-6">
        {/* Quotation source */}
        <div className="card p-5">
          <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Source quotation</h2>
          <p className="mb-4 text-xs text-ink/40">Optional - pick an approved quotation to pre-fill the client, project and line items.</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Quotation">
              <div className="relative">
                <FaLink className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <Select
                  className="pl-9"
                  placeholder="Create a blank invoice"
                  options={quotations.map((q) => ({
                    value: q._id,
                    label: `${q.quotationNumber || ""} - ${q.clientName || ""}${q.projectName ? ` · ${q.projectName.slice(0, 30)}` : ""}`,
                  }))}
                  {...register("quotationId")}
                  onChange={(e) => applyQuotation(e.target.value)}
                />
              </div>
            </Field>
            {prefillLoading && <div className="self-end text-sm text-ink/40">Loading quotation...</div>}
          </div>

          {prefill && (
            <div className="mt-3 rounded-xl bg-base/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-semibold text-primary">{prefill.quotation?.quotationNumber}</span>
                <span className="text-ink/70">{prefill.quotation?.clientName}</span>
                <span className="text-ink/40">Total: {formatMoney(prefill.quotation?.totalAmount)}</span>
                <span className="text-ink/40">Status: {prefill.quotation?.status}</span>
              </div>
              {usedTypes.length > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Invoice types already used for this quotation: {usedTypes.join(", ")}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Project payment summary */}
        {prefill && Number(prefill.summary?.projectTotal) > 0 && (
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Project payment tracking</h2>
              <p className="mt-0.5 text-xs text-ink/40">
                Auto-computed from the approved quotation ({prefill.quotation?.quotationNumber}) and the paid invoices. Balances are never entered manually.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-base/70 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Project Total</div>
                <div className="mt-0.5 font-bold text-ink">{formatMoney(prefill.summary.projectTotal)}</div>
              </div>
              <div className="rounded-xl bg-base/70 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Previous Payments</div>
                <div className="mt-0.5 font-bold text-ink">{formatMoney(prefill.summary.previousPaid)}</div>
              </div>
              <div className="rounded-xl bg-primary/10 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">Current Invoice</div>
                <div className="mt-0.5 font-bold text-primary">{formatMoney(totals.totalAmount)}</div>
              </div>
              <div className="rounded-xl bg-base/70 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Total Paid Till Date</div>
                <div className="mt-0.5 font-bold text-emerald-600">{formatMoney(prefill.summary.totalPaidTillDate)}</div>
              </div>
              <div className="rounded-xl bg-base/70 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Outstanding Balance</div>
                <div className={`mt-0.5 font-bold ${Number(prefill.summary.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatMoney(prefill.summary.remainingBalance)}
                </div>
              </div>
            </div>

            {prefill.existing?.length > 0 && (
              <div className="mt-4 border-t border-base pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/50">Invoice history (payment timeline)</div>
                <div className="divide-y divide-base">
                  {prefill.existing.map((inv) => (
                    <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <span className="font-semibold text-ink">{inv.invoiceNumber}</span>
                        <span className="ml-2 text-[11px] capitalize text-ink/45">{inv.type} · {formatDate(inv.sentAt || inv.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-ink/60">Amount {formatMoney(inv.totalAmount)}</span>
                        <span className="font-medium text-emerald-600">Paid {formatMoney(inv.amountPaid)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                          inv.paymentStatus === "paid"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : inv.paymentStatus === "partial"
                              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                              : inv.paymentStatus === "overdue"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableToInvoice != null && availableToInvoice < Number(prefill.summary.remainingBalance) && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                Available to invoice: {formatMoney(availableToInvoice)}. Outstanding invoices reduce what can still be raised for this project.
              </p>
            )}
          </div>
        )}

        {/* Client details */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Client details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client Name" required error={errors.clientName?.message}>
              <Input placeholder="e.g. Mr. Arun Kumar" {...register("clientName", { required: "Client name is required", maxLength: { value: 200, message: "Max 200 characters" } })} />
            </Field>
            <Field label="Business Name" error={errors.businessName?.message}>
              <Input placeholder="e.g. Cafe Madurai" {...register("businessName", { maxLength: { value: 200, message: "Max 200 characters" } })} />
            </Field>
            <Field label="Mobile Number" required error={errors.mobile?.message} hint="Indian mobile number - e.g. 98765 43210">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">+91</span>
                <Input className="pl-11" placeholder="98765 43210" {...register("mobile", { required: "Mobile number is required", validate: (v) => isValidMobileNumber(v) || "Enter a valid mobile number" })} />
              </div>
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" placeholder="client@business.com" {...register("email", { pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address" } })} />
            </Field>
            <Field label="Billing Address" error={errors.billingAddress?.message}>
              <Input placeholder="Address, city, pincode" {...register("billingAddress", { maxLength: { value: 1000, message: "Max 1000 characters" } })} />
            </Field>
            <Field label="GSTIN" error={errors.gstin?.message}>
              <Input placeholder="e.g. 33ABCDE1234F1Z5" {...register("gstin", { maxLength: { value: 20, message: "Max 20 characters" } })} />
            </Field>
          </div>
        </div>

        {/* Project details */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Project details</h2>
          <div className="grid gap-4">
            <Field label="Project Name" required error={errors.projectName?.message}>
              <Input placeholder="e.g. Restaurant Website with Online Ordering" {...register("projectName", { required: "Project name is required", maxLength: { value: 200, message: "Max 200 characters" } })} />
            </Field>
            <Field label="Project Description" error={errors.projectDescription?.message}>
              <Textarea rows={3} placeholder="Describe the project scope and deliverables..." {...register("projectDescription", { maxLength: { value: 5000, message: "Max 5000 characters" } })} />
            </Field>
          </div>
        </div>

        {/* Line items */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink/60">Line Items</h2>
            <Button size="sm" variant="secondary" type="button" onClick={() => append({ name: "", description: "", quantity: "1", unitPrice: "" })}>
              <FaPlus className="h-3 w-3" /> Add item
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded-xl bg-base/60 px-4 py-6 text-center text-sm text-ink/40">
              No line items yet. Add items or save with an empty list.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={field.id} className="grid gap-3 rounded-xl border border-base bg-base/40 p-3 sm:grid-cols-[1.2fr_1.5fr_90px_120px_auto]">
                  <Field label={i === 0 ? "Item / Service" : ""} error={errors.items?.[i]?.name?.message}>
                    <Input placeholder="e.g. Website Design" {...register(`items.${i}.name`, { required: "Item name is required" })} />
                  </Field>
                  <Field label={i === 0 ? "Description" : ""}>
                    <Input placeholder="e.g. 5-page responsive design" {...register(`items.${i}.description`)} />
                  </Field>
                  <Field label={i === 0 ? "Qty" : ""}>
                    <Input type="number" min="0" placeholder="1" {...register(`items.${i}.quantity`)} />
                  </Field>
                  <Field label={i === 0 ? "Unit (Rs.)" : ""}>
                    <Input type="number" min="0" placeholder="25000" {...register(`items.${i}.unitPrice`)} />
                  </Field>
                  <div className="flex items-end justify-end pb-0.5">
                    <button type="button" onClick={() => remove(i)} className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100" title="Remove item">
                      <FaTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-40">
              <Field label="Discount (Rs.)">
                <Input type="number" min="0" placeholder="0" {...register("discount")} />
              </Field>
            </div>
            <div className="w-full sm:w-40">
              <Field label="Discount Type">
                <Select {...register("discountType")} options={DISCOUNT_TYPE_OPTIONS} placeholder={false} />
              </Field>
            </div>
            <div className="w-full sm:w-40">
              <Field label="Tax Rate (%)">
                <Input type="number" min="0" max="100" placeholder="0" {...register("taxRate")} />
              </Field>
            </div>
            <div className="ml-auto space-y-1 text-sm">
              <div className="flex justify-between gap-8"><span className="text-ink/50">Subtotal</span><span className="font-semibold text-ink">{formatMoney(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && <div className="flex justify-between gap-8"><span className="text-ink/50">Discount</span><span className="font-semibold text-red-600">- {formatMoney(totals.discountAmount)}</span></div>}
              {totals.taxAmount > 0 && <div className="flex justify-between gap-8"><span className="text-ink/50">Tax</span><span className="font-semibold text-ink">{formatMoney(totals.taxAmount)}</span></div>}
              <div className="flex justify-between gap-8 border-t border-base pt-1"><span className="font-semibold text-ink">Total</span><span className="font-extrabold text-primary">{formatMoney(totals.totalAmount)}</span></div>
            </div>
          </div>
        </div>

        {/* Dates, type, payment */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink/60">Invoice settings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Invoice Type" hint={prefill ? "One invoice per type per quotation" : ""}>
              <Select {...register("type")} options={INVOICE_TYPE_OPTIONS} placeholder={false} />
            </Field>
            <Field label="Invoice Date" required error={errors.invoiceDate?.message}>
              <Input type="date" {...register("invoiceDate", { required: "Invoice date is required" })} />
            </Field>
            <Field label="Due Date" error={errors.dueDate?.message}>
              <Input type="date" {...register("dueDate")} />
            </Field>
            <Field label="Preferred Payment Method">
              <Select {...register("paymentMethod")} options={PAYMENT_METHOD_OPTIONS} placeholder={false} />
            </Field>
            <Field label="Terms">
              <Textarea rows={2} placeholder="Payment terms..." {...register("terms", { maxLength: { value: 5000, message: "Max 5000 characters" } })} />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} placeholder="Optional notes shown on the invoice..." {...register("notes", { maxLength: { value: 3000, message: "Max 3000 characters" } })} />
            </Field>
          </div>
        </div>

        {/* Actions */}
        <div className="card flex flex-wrap items-center justify-end gap-3 p-4">
          <Button type="button" variant="ghost" onClick={() => { reset(DEFAULT_VALUES); toast.info("Form reset"); }}>
            <FaUndoAlt /> Reset
          </Button>
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            <FaSave /> Save Draft
          </Button>
          <Select className="w-40" value={channel} onChange={(e) => setChannel(e.target.value)} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "both", label: "Both" }]} placeholder={false} title="Send channel" />
          <Button type="button" onClick={openSendPreview}>
            <FaPaperPlane /> Send Invoice
          </Button>
        </div>
      </form>

      <InvoicePreviewModal
        open={preview}
        onClose={() => setPreview(false)}
        invoice={pendingPayload}
        channel={channel}
        onSend={doSend}
        sending={sending}
      />
    </div>
  );
}
