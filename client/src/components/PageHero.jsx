import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa6";
import Reveal from "./Reveal";

export default function PageHero({ title, subtitle, crumb }) {
  return (
    <section className="relative overflow-hidden bg-ink pt-36 pb-20 text-white md:pt-44 md:pb-24">
      <div className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
      <div className="container-x relative">
        <Reveal>
          <nav className="mb-4 flex items-center gap-2 text-sm text-white/50">
            <Link to="/" className="hover:text-white">Home</Link>
            <FaChevronRight className="h-3 w-3" />
            {crumb && <><span className="text-white/50">{crumb}</span><FaChevronRight className="h-3 w-3" /></>}
            <span className="text-white">{title}</span>
          </nav>
          <h1 className="heading-xl">{title}</h1>
          {subtitle && <p className="mt-4 max-w-2xl text-lg text-white/70">{subtitle}</p>}
        </Reveal>
      </div>
    </section>
  );
}