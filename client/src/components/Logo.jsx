import { Link } from "react-router-dom";
import logo from "../assets/logo.png"
export default function Logo({ dark = false, className = "" }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 group ${className}`} aria-label="Skyntrix Technologies home">
      <span className="relative grid h-10 w-10 place-items-center rounded-xl  group-hover:scale-105">
      <img src={logo} alt="" />
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
          Skyntrix
        </span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.22em] ${dark ? "text-white/60" : "text-ink/50"}`}>
          Technologies
        </span>
      </span>
    </Link>
  );
}