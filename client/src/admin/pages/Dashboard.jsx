import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FaEnvelope, FaBriefcase, FaNewspaper, FaUsers, FaImages, FaPaperclip, FaEye } from "react-icons/fa";
import { adminGet } from "../api";
import { useAuth } from "../AuthContext";
import { Loading } from "../components/Ui";

const cardMeta = [
  { key: "leads", label: "Total Leads", icon: FaEnvelope, color: "text-blue-600 bg-blue-50" },
  { key: "convertedLeads", label: "Converted", icon: FaPaperclip, color: "text-emerald-600 bg-emerald-50" },
  { key: "careerApplications", label: "Applications", icon: FaBriefcase, color: "text-purple-600 bg-purple-50" },
  { key: "newsletterSubscribers", label: "Subscribers", icon: FaUsers, color: "text-pink-600 bg-pink-50" },
  { key: "blogs", label: "Blog Posts", icon: FaNewspaper, color: "text-indigo-600 bg-indigo-50" },
  { key: "portfolio", label: "Projects", icon: FaImages, color: "text-orange-600 bg-orange-50" },
  { key: "services", label: "Services", icon: FaPaperclip, color: "text-teal-600 bg-teal-50" },
  { key: "totalBlogViews", label: "Blog Views", icon: FaEye, color: "text-slate-600 bg-slate-100" },
];

const PERIODS = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

const SERIES = [
  { key: "leads", label: "Leads", color: "#2563EB" },
  { key: "applications", label: "Applications", color: "#6D28D9" },
];

const REFRESH_MS = 60 * 1000;

function GroupedBarChart({ labels = [], leads = [], applications = [] }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);

  const W = 1000;
  const H = 300;
  const pad = { top: 18, right: 12, bottom: 36, left: 44 };
  const n = Math.max(1, labels.length);
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const groupW = innerW / n;
  const barW = Math.max(4, Math.min(22, groupW * 0.3));
  const max = Math.max(1, ...leads, ...applications);
  const yFor = (v) => pad.top + innerH - (v / max) * innerH;
  const hFor = (v) => (v / max) * innerH;
  const showLabels = n <= 16;
  const labelStep = Math.max(1, Math.ceil(n / 12));
const isMobile = window.innerWidth < 640;
const isTablet = window.innerWidth < 1024;

const labelFontSize = isMobile ? 25 : isTablet ? 14 : 18;
  const handleMove = (e, i) => {
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <line x1={pad.left} y1={pad.top + innerH} x2={W - pad.right} y2={pad.top + innerH} stroke="#E2E8F0" strokeWidth={1} />
        <line x1={pad.left} y1={pad.top} x2={W - pad.right} y2={pad.top} stroke="#F1F5F9" strokeWidth={1} strokeDasharray="3 3" />
        <text x={pad.left - 8} y={pad.top + 3} textAnchor="end" fontSize={10} fill="#94A3B8">{max}</text>

        {labels.map((label, i) => {
          const cx = pad.left + i * groupW + groupW / 2;
          const xL = cx - barW - 1.5;
          const xA = cx + 1.5;
          const lv = leads[i] || 0;
          const av = applications[i] || 0;
          return (
            <g
              key={i}
              onMouseEnter={(e) => handleMove(e, i)}
              onMouseMove={(e) => handleMove(e, i)}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={pad.left + i * groupW} y={pad.top} width={groupW} height={innerH} fill="transparent" />
              <motion.rect
                x={xL}
                width={barW}
                rx={3}
                fill={SERIES[0].color}
                initial={{ height: 0, y: pad.top + innerH }}
                animate={{ height: hFor(lv), y: yFor(lv) }}
                transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
              />
              <motion.rect
                x={xA}
                width={barW}
                rx={3}
                fill={SERIES[1].color}
                initial={{ height: 0, y: pad.top + innerH }}
                animate={{ height: hFor(av), y: yFor(av) }}
                transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
              />
              {showLabels && (
                <>
                  <text x={xL + barW / 2} y={yFor(lv) - 4} textAnchor="middle" fontSize={9} fill="#64748B">{lv || ""}</text>
                  <text x={xA + barW / 2} y={yFor(av) - 4} textAnchor="middle" fontSize={9} fill="#64748B">{av || ""}</text>
                </>
              )}
              {i % labelStep === 0 && (
                <text
                  x={cx}
                  y={pad.top + innerH + 16}
                  textAnchor="middle"
                  fontSize={labelFontSize}
                  fill="#64748B"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-soft"
          style={{ left: Math.min(tip.x + 12, W * 0.6), top: Math.max(tip.y - 24, 0) }}
        >
          <div className="font-semibold">{labels[tip.i]}</div>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[0].color }} /> Leads: {leads[tip.i] || 0}</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[1].color }} /> Applications: {applications[tip.i] || 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { admin } = useAuth();
  const [period, setPeriod] = useState("year");
  const [overview, setOverview] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);

  const loadMain = useCallback(async (p, silent = false) => {
    if (!silent && firstLoad.current) setLoading(true);
    try {
      const [o, c] = await Promise.all([
        adminGet("/dashboard/overview"),
        adminGet(`/dashboard/charts?period=${p}`),
      ]);
      setOverview(o.data?.totals || {});
      setCharts(c.data || null);
      firstLoad.current = false;
    } catch (_) {
      // keep last known values on transient failures
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMain(period);
  }, [period, loadMain]);

  useEffect(() => {
    adminGet("/dashboard/activity")
      .then((a) => setActivity(a.data || []))
      .catch(() => { });
  }, []);

  // Keep chart + cards synced with the database even after external CRUD.
  useEffect(() => {
    const id = setInterval(() => loadMain(period, true), REFRESH_MS);
    return () => clearInterval(id);
  }, [period, loadMain]);

  if (loading) return <Loading />;

  const totals = overview || {};
  const labels = charts?.labels || [];
  const leadSeries = charts?.leads || [];
  const appSeries = charts?.applications || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="heading-md text-ink">Welcome back, {admin?.name?.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink/50">Here's what's happening on Skyntrix.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cardMeta.map((c) => (
          <div key={c.key} className="card p-4">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-extrabold text-ink">{totals[c.key] ?? 0}</div>
            <div className="text-sm text-ink/50">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-bold text-ink">New leads & applications</h2>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${period === p.key ? "bg-primary-gradient text-white" : "bg-base text-ink/60 hover:text-primary"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex items-center gap-4 text-xs text-ink/60">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>

          {labels.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-ink/40">No data available.</div>
          ) : (
            <GroupedBarChart labels={labels} leads={leadSeries} applications={appSeries} />
          )}
        </div>

        {/* Activity */}
        <div className="card p-5">
          <h2 className="mb-4 font-display font-bold text-ink">Recent activity</h2>
          <div className="space-y-3">
            {activity.length === 0 && <div className="text-sm text-ink/40">No activity yet.</div>}
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{a.title}</div>
                  <div className="truncate text-xs text-ink/40">{a.desc}</div>
                </div>
                <span className="ml-auto shrink-0 text-[11px] text-ink/30">{new Date(a.time).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
