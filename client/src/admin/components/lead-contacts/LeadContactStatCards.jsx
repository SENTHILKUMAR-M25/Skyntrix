import { FaLayerGroup, FaClock, FaCalendarAlt, FaFileAlt, FaPaperPlane, FaExclamationTriangle } from "react-icons/fa";
import { cn } from "../../../lib/utils";

const CARDS = [
  { key: "total", label: "Total Leads", icon: FaLayerGroup, cls: "text-indigo-600 bg-indigo-50" },
  { key: "today", label: "Today's Leads", icon: FaClock, cls: "text-blue-600 bg-blue-50" },
  { key: "monthly", label: "Monthly Leads", icon: FaCalendarAlt, cls: "text-purple-600 bg-purple-50" },
  { key: "draft", label: "Draft Leads", icon: FaFileAlt, cls: "text-amber-600 bg-amber-50" },
  { key: "sent", label: "Sent Leads", icon: FaPaperPlane, cls: "text-emerald-600 bg-emerald-50" },
  { key: "failed", label: "Failed Leads", icon: FaExclamationTriangle, cls: "text-red-600 bg-red-50" },
];

export function StatCardSkeleton() {
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

export default function LeadContactStatCards({ stats = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {CARDS.map((c) => <StatCardSkeleton key={c.key} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {CARDS.map((c) => (
        <div key={c.key} className="card group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
          <div className={cn("mb-3 grid h-10 w-10 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110", c.cls)}>
            <c.icon className="h-5 w-5" />
          </div>
          <div className="text-2xl font-extrabold text-ink">{stats[c.key] ?? 0}</div>
          <div className="text-sm text-ink/50">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
