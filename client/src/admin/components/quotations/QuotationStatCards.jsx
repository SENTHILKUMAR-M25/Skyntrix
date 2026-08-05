import { FaLayerGroup, FaFileLines, FaPaperPlane, FaTriangleExclamation, FaClock, FaCalendarDays, FaIndianRupeeSign, FaCircleCheck } from "react-icons/fa6";
import { cn } from "../../../lib/utils";

const CARDS = [
  { key: "total", label: "Total Quotations", icon: FaLayerGroup, cls: "text-indigo-600 bg-indigo-50" },
  { key: "draft", label: "Draft", icon: FaFileLines, cls: "text-amber-600 bg-amber-50" },
  { key: "sent", label: "Sent", icon: FaPaperPlane, cls: "text-emerald-600 bg-emerald-50" },
  { key: "failed", label: "Failed", icon: FaTriangleExclamation, cls: "text-red-600 bg-red-50" },
  { key: "pending", label: "Pending WhatsApp", icon: FaClock, cls: "text-slate-600 bg-slate-100" },
  { key: "sentToday", label: "Sent Today", icon: FaCalendarDays, cls: "text-blue-600 bg-blue-50" },
];

const VALUE_CARDS = [
  { key: "totalValue", label: "Total Value (All)", icon: FaIndianRupeeSign, cls: "text-purple-600 bg-purple-50" },
  { key: "sentValue", label: "Sent Value", icon: FaCircleCheck, cls: "text-teal-600 bg-teal-50" },
];

function CardSkeleton() {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="animate-shimmer h-full w-full bg-gradient-to-r from-transparent via-white to-transparent" />
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

export default function QuotationStatCards({ stats = {}, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        {VALUE_CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
      </div>
    </div>
  );
}
