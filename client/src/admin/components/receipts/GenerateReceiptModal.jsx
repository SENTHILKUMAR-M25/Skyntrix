import { useEffect, useState } from "react";
import { FaReceipt, FaFileInvoice } from "react-icons/fa6";
import { FaCheckCircle } from "react-icons/fa";
import { Modal, Button, Field, Input, Select, EmptyState } from "../Ui";
import { adminGet, adminPost } from "../../api";
import { useToast } from "../../Toast";
import { formatMoney, formatDate, RECEIPT_PAYMENT_METHOD_OPTIONS } from "../../utils/receipt";

/**
 * Generate a Payment Receipt for a paid invoice.
 * Props: open, onClose, onGenerated(receipt), invoice (optional preselected).
 * When no invoice is passed the admin picks one from the paid invoices list.
 */
export default function GenerateReceiptModal({ open, onClose, onGenerated, invoice: preselected }) {
  const { toast } = useToast();
  const [paidInvoices, setPaidInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [paymentEntryId, setPaymentEntryId] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    if (preselected?._id) {
      setInvoice(preselected);
    } else {
      setInvoice(null);
      loadPaidInvoices();
    }
  }, [open, preselected]);

  const loadPaidInvoices = async () => {
    setLoading(true);
    try {
      const res = await adminGet("/invoices", { paymentStatus: "paid", limit: 100, sort: "createdAt:desc" });
      setPaidInvoices(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectInvoice = (inv) => {
    setInvoice(inv);
    const last = inv.payments?.[inv.payments.length - 1];
    if (last) {
      setPaymentEntryId(last._id || "");
      setMethod(last.method || "bank_transfer");
      setReference(last.reference || "");
      setPaidOn((last.paidOn || new Date()).slice(0, 10));
      setNote(last.note || "");
    } else {
      setPaymentEntryId("");
      setMethod(inv.paymentMethod || "bank_transfer");
      setReference("");
      setPaidOn(inv.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setNote("");
    }
  };

  useEffect(() => {
    if (invoice?._id) selectInvoice(invoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?._id]);

  const handleGenerate = async () => {
    if (!invoice) {
      toast.error("Select an invoice");
      return;
    }
    setSaving(true);
    try {
      const res = await adminPost("/receipts/generate", {
        invoiceId: invoice._id,
        paymentEntryId: paymentEntryId || undefined,
        method,
        reference,
        paidOn: paidOn ? new Date(paidOn).toISOString() : undefined,
        note,
      });
      toast.ok(res.message || "Receipt generated");
      onGenerated?.(res.data);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const payments = invoice?.payments || [];
  const paymentOptions = payments.length
    ? payments.map((p, i) => ({
        value: p._id || `idx-${i}`,
        label: `${formatMoney(p.amount)} · ${String(p.method || "other").replace(/_/g, " ")} · ${formatDate(p.paidOn)}${p.reference ? ` · ${p.reference}` : ""}`,
      }))
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Payment Receipt"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} loading={saving}>
            <FaReceipt className="h-3.5 w-3.5" /> Generate Receipt
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!preselected?._id && (
          <Field label="Paid invoice" required>
            {loading ? (
              <div className="py-2 text-sm text-ink/40">Loading paid invoices...</div>
            ) : paidInvoices.length === 0 ? (
              <EmptyState title="No paid invoices yet" hint="Mark an invoice as Paid before generating its receipt." />
            ) : (
              <Select
                value={invoice?._id || ""}
                onChange={(e) => {
                  const inv = paidInvoices.find((x) => x._id === e.target.value);
                  if (inv) selectInvoice(inv);
                }}
                options={paidInvoices.map((inv) => ({
                  value: inv._id,
                  label: `${inv.invoiceNumber} · ${inv.clientName} · ${inv.projectName}`,
                }))}
                placeholder="Select a paid invoice..."
              />
            )}
          </Field>
        )}

        {invoice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 font-bold text-emerald-700">
                <FaCheckCircle className="h-4 w-4" /> {invoice.invoiceNumber}
              </span>
              <span className="text-ink/70">{invoice.clientName}</span>
              <span className="text-ink/50">{invoice.projectName}</span>
              <span className="ml-auto font-semibold text-ink">Paid: {formatMoney(invoice.amountPaid)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink/55">
              <span>Total: {formatMoney(invoice.totalAmount)}</span>
              <span>Balance due: {formatMoney(invoice.balanceDue)}</span>
              <span className="inline-flex items-center gap-1"><FaFileInvoice className="h-3 w-3" /> Quotation: {invoice.quotationNumber || "—"}</span>
            </div>
          </div>
        )}

        {invoice && payments.length > 0 && (
          <Field label="Payment transaction" hint="Pick which payment this receipt certifies. A separate receipt is generated for each payment.">
            <Select
              value={paymentEntryId}
              onChange={(e) => {
                const entry = payments.find((p) => String(p._id) === e.target.value);
                setPaymentEntryId(e.target.value);
                if (entry) {
                  setMethod(entry.method || "bank_transfer");
                  setReference(entry.reference || "");
                  setPaidOn((entry.paidOn || new Date()).slice(0, 10));
                  setNote(entry.note || "");
                }
              }}
              options={paymentOptions}
              placeholder="Select a payment..."
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment method" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)} options={RECEIPT_PAYMENT_METHOD_OPTIONS} placeholder={false} />
          </Field>
          <Field label="Transaction ID / UTR">
            <Input placeholder="UTR / transaction id" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Payment date" required>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <Input placeholder="Optional note shown on the receipt" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
