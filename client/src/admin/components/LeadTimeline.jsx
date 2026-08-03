import { AnimatePresence, motion } from "framer-motion";
import { FaArrowRight, FaEdit, FaTrash } from "react-icons/fa";
import { Badge } from "./Ui";
import { cn } from "../../lib/utils";

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fullTime = (date) =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Avatar({ entry }) {
  if (entry.createdByAvatar) {
    return (
      <img
        src={entry.createdByAvatar}
        alt={entry.createdByName}
        className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
      />
    );
  }
  const initials = (entry.createdByName || "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary-gradient text-xs font-bold text-white shadow-sm">
      {initials || "?"}
    </span>
  );
}

export default function LeadTimeline({ entries, canEdit, canDelete, onEdit, onDelete }) {
  if (!entries.length) return null;

  return (
    <div className="relative">
      {/* Vertical rail */}
      <div className="absolute bottom-6 left-[19px] top-2 w-px bg-gradient-to-b from-primary/50 via-primary/15 to-transparent" />

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => {
            const isNoteOnly = entry.previousStatus === entry.newStatus;
            const editable = canEdit(entry);
            const deletable = canDelete(entry);
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
                  {/* Node */}
                  <div className="absolute left-0 top-0">
                    <Avatar entry={entry} />
                  </div>

                  <div className="card group relative p-4 transition-shadow hover:shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-ink">{entry.createdByName}</span>
                          <span className="text-xs text-ink/40">· {fullTime(entry.createdAt)}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {isNoteOnly ? (
                            <Badge value={entry.newStatus} />
                          ) : (
                            <>
                              <Badge value={entry.previousStatus} />
                              <FaArrowRight className="h-3 w-3 text-ink/30" />
                              <Badge value={entry.newStatus} />
                            </>
                          )}
                          <span className="text-[11px] font-medium uppercase tracking-wide text-ink/40">
                            {isNoteOnly ? "note added" : "status change"}
                          </span>
                        </div>
                      </div>

                      {(editable || deletable) && (
                        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          {editable && (
                            <button
                              onClick={() => onEdit(entry)}
                              className="rounded-md p-2 text-ink/40 hover:bg-primary/10 hover:text-primary"
                              title="Edit note"
                            >
                              <FaEdit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {deletable && (
                            <button
                              onClick={() => onDelete(entry)}
                              className="rounded-md p-2 text-ink/40 hover:bg-red-50 hover:text-red-600"
                              title="Delete note"
                            >
                              <FaTrash className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {entry.note ? (
                      <div className="mt-3 rounded-xl bg-base/80 px-4 py-3 text-sm leading-relaxed text-ink/80">
                        {entry.note}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs italic text-ink/40">No note was provided for this change.</p>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-ink/30">{timeAgo(entry.createdAt)}</span>
                      {entry.updatedAt && new Date(entry.updatedAt).getTime() !== new Date(entry.createdAt).getTime() && (
                        <span className="text-[11px] text-ink/30">edited {timeAgo(entry.updatedAt)}</span>
                      )}
                    </div>
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
