import { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaXmark, FaCalendarCheck } from "react-icons/fa6";
import LeadForm from "./LeadForm";

const Ctx = createContext(null);
export const useConsult = () => useContext(Ctx);

export function ConsultProvider({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, close: () => setOpen(false), openConsult: () => setOpen(true) }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-soft"
            >
              <div className="relative bg-primary-gradient p-6 text-white">
                <FaCalendarCheck className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
                <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30">
                  <FaXmark />
                </button>
                <span className="text-xs font-semibold uppercase tracking-widest text-white/80">Free Consultation</span>
                <h3 className="mt-1 font-display text-2xl font-bold">Let's Discuss Your Project</h3>
                <p className="mt-1 text-sm text-white/80">Book a free 30-minute strategy call. Zero pressure, zero obligations.</p>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-6">
                <LeadForm />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}