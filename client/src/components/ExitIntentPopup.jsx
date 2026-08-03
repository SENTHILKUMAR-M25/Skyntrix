import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaXmark, FaGift } from "react-icons/fa6";
import Newsletter from "./Newsletter";

export default function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("skyntrix-popup")) return;
    const onExit = (e) => {
      if (e.clientY <= 0 && !sessionStorage.getItem("skyntrix-popup")) {
        setShow(true);
        sessionStorage.setItem("skyntrix-popup", "1");
        document.removeEventListener("mouseout", onExit);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mouseout", onExit);
    }, 3000);
    return () => { clearTimeout(timer); document.removeEventListener("mouseout", onExit); };
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[80] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-primary-gradient p-8 text-center text-white shadow-soft"
          >
            <button onClick={() => { setShow(false); setDismissed(true); }} aria-label="Close" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <FaXmark />
            </button>
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-white/15"><FaGift className="h-7 w-7" /></span>
            <h3 className="font-display text-2xl font-bold">Wait — Don't Go Yet!</h3>
            <p className="mt-2 text-sm text-white/85">Subscribe for exclusive tips, case studies & a free website audit guide. No spam, ever.</p>
            <div className="mt-5 flex justify-center">
              <Newsletter />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}