import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaBars, FaXmark, FaPhone } from "react-icons/fa6";
import Logo from "./Logo";
import { SITE } from "../config/site";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/pricing", label: "Pricing" },
  // { to: "/blog", label: "Blog" },
  // { to: "/careers", label: "Careers" },
  { to: "/contact", label: "Contact" }
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const navBase = "bg-white/90 backdrop-blur-xl shadow-card border-b border-ink/5" ;

  return (
    <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${navBase}`}>
      <nav className="container-x flex h-20 items-center justify-between">
        <Logo />
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? " text-primary" : "text-ink/70 hover:text-ink"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`} className="btn-primary hidden md:inline-flex !px-5 !py-2.5 text-sm">
            <FaPhone className="h-3.5 w-3.5" />Book a Call
          </a>
          <button onClick={() => setOpen(!open)} aria-label="Toggle menu" className="grid h-10 w-10 place-items-center rounded-full border border-ink/10 lg:hidden text-ink">
            {open ? <FaXmark className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-ink/5 bg-white/95 backdrop-blur-xl lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className="rounded-xl px-4 py-3 text-base font-medium text-ink/80 hover:bg-primary/5 hover:text-primary">
                  {l.label}
                </NavLink>
              ))}
              <Link to="/contact" className="btn-primary mt-3 w-full">Get Free Consultation</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}