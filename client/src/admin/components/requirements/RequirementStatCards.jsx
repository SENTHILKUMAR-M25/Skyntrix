import { FaLayerGroup, FaPencil, FaClipboardCheck, FaMagnifyingGlass, FaCheckDouble, FaIndianRupeeSign } from "react-icons/fa6";
import { cn } from "../../../lib/utils";
import { formatMoney } from "../../utils/requirement";

const CARDS = [
  { key: "total", label: "Total Requirements", icon: FaLayerGroup, cls: "text-indigo-600 bg-indigo-50" },
  { key: "draft", label: "Draft", icon: FaPencil, cls: "text-slate-600 bg-slate-100" },
  { key: "collected", label: "Collected", icon: FaClipboardCheck, cls: "text-cyan-600 bg-cyan-50" },
  { key: "underReview", label: "Under Review", icon: FaMagnifyingGlass, cls: "text-amber-600 bg-amber-50" },
  { key: "ready", label: "Ready for Quotation", icon: FaCheckDouble, cls: "text-emerald-600 bg-emerald-50" },
  { key: "readyValue", label: "Ready Value", icon: FaIndianRupeeSign, cls: "text-purple-600 bg-purple-50", money: true },
];

function CardSkeleton() {
  return (
    <div className="card p-4">
      <div className="mb-3 h-10 w-10 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-6 w-16 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-1 h-3 w-24 animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}

function Card({ card, stats }) {
  return (
    <div className="card group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
      <div className={cn("mb-3 grid h-10 w-10 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110", card.cls)}>
        <card.icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold text-ink">
        {card.money ? formatMoney(stats[card.key]) : stats[card.key] ?? 0}
      </div>
      <div className="text-sm text-ink/50">{card.label}</div>
    </div>
  );
}

export default function RequirementStatCards({ stats = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {CARDS.map((c) => <CardSkeleton key={c.key} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {CARDS.map((c) => <Card key={c.key} card={c} stats={stats} />)}
    </div>
  );
}
