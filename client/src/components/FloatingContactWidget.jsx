import { useEffect, useState } from "react";
import { FaWhatsapp, FaComments } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { SITE, whatsAppLink } from "../config/site";

export default function FloatingContactWidget() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="mb-1 flex flex-col gap-2 rounded-2xl border border-ink/5 bg-white p-3 shadow-soft">
          <a
            href={whatsAppLink()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-green-50"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-green-500 text-white"><FaWhatsapp /></span>
            <span className="text-sm font-medium">WhatsApp Us</span>
          </a>
          <a href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-primary/5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-gradient text-white"><FaComments /></span>
            <span className="text-sm font-medium">Book a Call</span>
          </a>
          <Link to="/contact" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-primary/5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-white">→</span>
            <span className="text-sm font-medium">Get a Quote</span>
          </Link>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Contact options"
        className="group grid h-14 w-14 place-items-center rounded-full bg-primary-gradient text-white shadow-soft transition-transform hover:scale-105"
      >
        {open ? (
          <span className="text-2xl">×</span>
        ) : (
          <FaComments className="text-2xl" />
        )}
      </button>
    </div>
  );
}