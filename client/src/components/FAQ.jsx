import { useState } from "react";
import { FaPlus } from "react-icons/fa6";
import Reveal from "./Reveal";

export default function FAQ({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <Reveal key={i} delay={i * 0.05}>
            <div className={`card overflow-hidden transition-all duration-300 ${isOpen ? "border-primary/30 shadow-soft" : ""}`}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-display font-semibold text-ink">{f.q}</span>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm transition-all duration-300 ${isOpen ? "bg-primary-gradient text-white rotate-45" : "bg-primary/10 text-primary"}`}>
                  <FaPlus />
                </span>
              </button>
              <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-ink/60 leading-relaxed">{f.a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}