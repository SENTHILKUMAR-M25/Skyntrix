import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaPen, FaWhatsapp, FaRedoAlt, FaExchangeAlt, FaStickyNote, FaCalendarCheck, FaUserCheck, FaTrash } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import { timeAgo } from "../../utils/leadContact";

const ACTION_META = {
  create: { icon: FaPlus, cls: "bg-emerald-100 text-emerald-700", label: "Created" },
  update: { icon: FaPen, cls: "bg-blue-100 text-blue-700", label: "Updated" },
  send: { icon: FaWhatsapp, cls: "bg-[#D9FBE8] text-[#128C4B]", label: "WhatsApp sent" },
  resend: { icon: FaRedoAlt, cls: "bg-[#D9FBE8] text-[#128C4B]", label: "WhatsApp resent" },
  status: { icon: FaExchangeAlt, cls: "bg-indigo-100 text-indigo-700", label: "Status change" },
  note: { icon: FaStickyNote, cls: "bg-amber-100 text-amber-700", label: "Note" },
  "follow-up": { icon: FaCalendarCheck, cls: "bg-purple-100 text-purple-700", label: "Follow-up" },
  assign: { icon: FaUserCheck, cls: "bg-teal-100 text-teal-700", label: "Assignment" },
  delete: { icon: FaTrash, cls: "bg-red-100 text-red-600", label: "Deleted" },
};

export default function LeadContactTimeline({ entries }) {
  if (!entries.length) return null;

  return (
    <div className="relative">
      <div className="absolute bottom-6 left-[19px] top-2 w-px bg-gradient-to-b from-primary/50 via-primary/15 to-transparent" />
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => {
            const meta = ACTION_META[entry.action] || ACTION_META.update;
            const Icon = meta.icon;
            return (
              <motion.div
                key={entry._id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
                transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative pl-12">
                  <div className="absolute left-0 top-0">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-sm", meta.cls)}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="card group p-4 transition-shadow hover:shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-ink">{entry.createdByName}</span>
                          <span className="text-xs text-ink/40">· {timeAgo(entry.createdAt)}</span>
                        </div>
                        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", meta.cls)}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {entry.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink/75">{entry.description}</p>
                    )}
                    {entry.meta?.waUrl && (
                      <a
                        href={entry.meta.waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 break-all text-xs font-semibold text-primary hover:underline"
                      >
                        <FaWhatsapp /> Open WhatsApp link
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
