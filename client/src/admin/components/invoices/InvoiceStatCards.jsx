import { FaLayerGroup, FaFileLines, FaPaperPlane, FaCircleCheck, FaClock, FaTriangleExclamation, FaIndianRupeeSign, FaMoneyBillTransfer, FaWallet } from "react-icons/fa6";
import { cn } from "../../../lib/utils";

const CARDS = [
  { key: "total", label: "Total Invoices", icon: FaLayerGroup, cls: "text-indigo-600 bg-indigo-50" },
  { key: "draft", label: "Draft", icon: FaFileLines, cls: "text-amber-600 bg-amber-50" },
  { key: "sent", label: "Sent", icon: FaPaperPlane, cls: "text-blue-600 bg-blue-50" },
  { key: "paid", label: "Paid", icon: FaCircleCheck, cls: "text-emerald-600 bg-emerald-50" },
  { key: "partial", label: "Partially Paid", icon: FaMoneyBillTransfer, cls: "text-cyan-600 bg-cyan-50" },
  { key: "overdue", label: "Overdue", icon: FaTriangleExclamation, cls: "text-red-600 bg-red-50" },
];

const VALUE_CARDS = [
  { key: "totalValue", label: "Total Invoiced", icon: FaIndianRupeeSign, cls: "text-purple-600 bg-purple-50" },
  { key: "paidValue", label: "Amount Received", icon: FaCircleCheck, cls: "text-teal-600 bg-teal-50" },
  { key: "outstandingValue", label: "Outstanding", icon: FaWallet, cls: "text-orange-600 bg-orange-50" },
  { key: "overdueValue", label: "Overdue Value", icon: FaClock, cls: "text-red-600 bg-red-50" },
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
      <div className="text-2xl font-extrabold text-ink">{card.key.includes("Value") ? formatMoney(stats[card.key]) : stats[card.key] ?? 0}</div>
      <div className="text-sm text-ink/50">{card.label}</div>
    </div>
  );
}

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

export default function InvoiceStatCards({ stats = {}, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {CARDS.map((c) => <CardSkeleton key={c.key} />)}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {VALUE_CARDS.map((c) => <CardSkeleton key={c.key} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {VALUE_CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
    </div>
  );
}
