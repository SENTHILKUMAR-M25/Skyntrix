import { FaReceipt, FaFileCircleCheck, FaIndianRupeeSign, FaCalendarCheck, FaLayerGroup } from "react-icons/fa6";
import { cn } from "../../../lib/utils";

const CARDS = [
  { key: "total", label: "Total Receipts", icon: FaReceipt, cls: "text-indigo-600 bg-indigo-50" },
  { key: "monthCount", label: "This Month", icon: FaCalendarCheck, cls: "text-blue-600 bg-blue-50" },
  { key: "generatedToday", label: "Generated Today", icon: FaFileCircleCheck, cls: "text-emerald-600 bg-emerald-50" },
  { key: "issuedInvoices", label: "Invoices Receipted", icon: FaLayerGroup, cls: "text-cyan-600 bg-cyan-50" },
];

const VALUE_CARDS = [
  { key: "totalReceived", label: "Total Received", icon: FaIndianRupeeSign, cls: "text-purple-600 bg-purple-50" },
  { key: "monthReceived", label: "Received This Month", icon: FaIndianRupeeSign, cls: "text-teal-600 bg-teal-50" },
];

function CardSkeleton() {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="space-y-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200" />
        <div className="h-6 w-16 rounded-md bg-slate-200" />
        <div className="h-3 w-24 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}

function Card({ card, stats }) {
  return (
    <div className="card group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
      <div className={cn("mb-3 grid h-10 w-10 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110", card.cls)}>
        <card.icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold text-ink">{card.key.includes("Received") ? formatMoney(stats[card.key]) : stats[card.key] ?? 0}</div>
      <div className="text-sm text-ink/50">{card.label}</div>
    </div>
  );
}

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

export default function ReceiptStatCards({ stats = {}, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CARDS.map((c) => <CardSkeleton key={c.key} />)}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
          {VALUE_CARDS.map((c) => <CardSkeleton key={c.key} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        {VALUE_CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
    </div>
  );
}
