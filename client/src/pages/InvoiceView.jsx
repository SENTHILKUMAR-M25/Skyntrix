import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_URL, SITE } from "../config/site";
import { cn } from "../lib/utils";

const API = (API_URL || "/api").replace(/\/$/, "");

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatMobile = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return value || "—";
};

const PAY_BADGE = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  partial: "bg-cyan-100 text-cyan-700 border-cyan-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

function InvoiceSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="animate-pulse space-y-4 rounded-2xl border border-base bg-white p-6 shadow-card">
        <div className="h-24 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 rounded-xl bg-slate-100" />
          <div className="h-24 rounded-xl bg-slate-100" />
        </div>
        <div className="h-40 rounded-xl bg-slate-100" />
        <div className="ml-auto h-28 w-56 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/invoices/share/${id}`);
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message || "Invoice not found");
        if (!cancelled) setInvoice(body?.data || null);
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load this invoice");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <InvoiceSkeleton />;

  if (error || !invoice) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-base bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-3xl">🧾</div>
          <h1 className="font-display text-xl font-bold text-ink">Invoice unavailable</h1>
          <p className="mt-2 text-sm text-ink/60">{error || "This invoice could not be found or is no longer available."}</p>
          <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-soft">
            Visit {SITE.shortName}
          </Link>
        </div>
      </div>
    );
  }

  const pdfUrl = invoice.pdfUrl ? `${invoice.pdfUrl}?v=${encodeURIComponent(invoice.updatedAt || Date.now())}` : "";
  const balanceDue = Number(invoice.balanceDue) || 0;

  return (
    <div className="min-h-screen bg-base py-10 px-4">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Header */}
        <div className="bg-ink px-8 py-7 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-display text-lg font-bold leading-tight">{SITE.name}</div>
              <div className="text-xs text-purple-300">{SITE.tagline}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold tracking-wide">INVOICE</div>
              <div className="mt-1 text-xs text-indigo-300">No: {invoice.invoiceNumber || "—"}</div>
              <div className="text-xs text-indigo-300">Date: {formatDate(invoice.invoiceDate)}</div>
              <div className="text-xs text-indigo-300">Due: {formatDate(invoice.dueDate)}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", PAY_BADGE[invoice.paymentStatus] || PAY_BADGE.pending)}>
              {invoice.paymentStatus}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium uppercase">{invoice.type}</span>
            <span className="ml-auto text-sm text-white/80">
              Balance due: <span className="font-bold text-white">{formatMoney(balanceDue)}</span>
            </span>
          </div>
        </div>

        <div className="p-8">
          {/* Bill to + project */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Bill to</div>
              <div className="mt-1 font-semibold text-ink">{invoice.clientName}</div>
              {invoice.businessName && <div className="text-sm text-ink/70">{invoice.businessName}</div>}
              <div className="mt-1 text-sm text-ink/60">
                {invoice.billingAddress && <div>{invoice.billingAddress}</div>}
                <div>{formatMobile(invoice.mobile)}</div>
                {invoice.email && <div>{invoice.email}</div>}
                {invoice.gstin && <div className="mt-1">GSTIN: {invoice.gstin}</div>}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Project</div>
              <div className="mt-1 font-semibold text-ink">{invoice.projectName}</div>
              <div className="text-sm text-ink/60">Payment method: {String(invoice.paymentMethod || "—").replace(/_/g, " ")}</div>
              {invoice.quotationNumber && <div className="text-sm text-ink/60">Quotation: {invoice.quotationNumber}</div>}
            </div>
          </div>

          {invoice.projectDescription && (
            <p className="mt-6 rounded-xl bg-base/70 p-4 text-sm leading-relaxed text-ink/70">{invoice.projectDescription}</p>
          )}

          {/* Items */}
          {invoice.items?.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-base">
              <table className="min-w-full divide-y divide-base text-sm">
                <thead className="bg-base/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-ink/60">Item</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/60">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/60">Unit Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink/60">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base">
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{item.name}</div>
                        {item.description && <div className="text-xs text-ink/50">{item.description}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">{item.quantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">{formatMoney(item.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
            {Number(invoice.projectTotal) > 0 && (
              <>
                <div className="flex justify-between border-b border-base pb-2"><span className="font-semibold text-ink/70">Project Total</span><span className="font-semibold text-ink">{formatMoney(invoice.projectTotal)}</span></div>
                <div className="flex justify-between px-3"><span className="text-ink/60">Total Paid Till Date</span><span className="font-medium text-emerald-600">{formatMoney(invoice.totalPaidTillDate)}</span></div>
                <div className="flex justify-between px-3"><span className="font-semibold text-ink">Outstanding Balance</span><span className={cn("font-bold", Number(invoice.remainingBalance) > 0 ? "text-red-600" : "text-emerald-600")}>{formatMoney(invoice.remainingBalance)}</span></div>
              </>
            )}
            <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span className="font-medium text-ink">{formatMoney(invoice.subtotal)}</span></div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between"><span className="text-ink/60">Discount</span><span className="font-medium text-red-600">- {formatMoney(invoice.discountAmount)}</span></div>
            )}
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between"><span className="text-ink/60">GST ({Number(invoice.taxRate) || 0}%)</span><span className="font-medium text-ink">{formatMoney(invoice.taxAmount)}</span></div>
            )}
            <div className="flex justify-between rounded-lg bg-purple-50 px-3 py-2"><span className="font-bold text-ink">Grand Total</span><span className="font-extrabold text-primary">{formatMoney(invoice.totalAmount)}</span></div>
            <div className="flex justify-between px-3"><span className="text-ink/60">Amount Paid</span><span className="font-medium text-emerald-600">{formatMoney(invoice.amountPaid)}</span></div>
            <div className="flex justify-between px-3"><span className="font-semibold text-ink">Balance Due</span><span className={cn("font-bold", balanceDue > 0 ? "text-red-600" : "text-emerald-600")}>{formatMoney(balanceDue)}</span></div>
          </div>

          {/* Notes / terms */}
          {invoice.notes && (
            <div className="mt-6 rounded-xl bg-base/70 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="mt-4 rounded-xl bg-base/70 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Terms</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{invoice.terms}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-base pt-5 sm:flex-row">
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-4 py-2 text-sm font-semibold text-white transition hover:shadow-soft">
                📄 Download invoice PDF
              </a>
            ) : <span />}
            <div className="text-center text-xs text-ink/50">
              <div>{SITE.name} · {SITE.address}</div>
              <div>{SITE.website.replace(/^https?:\/\//, "")} · {SITE.email}</div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-ink/40">
            This invoice was sent to you by {SITE.name}. Questions? Email <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
