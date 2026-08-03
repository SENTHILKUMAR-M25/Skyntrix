import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import { Icon } from "./icons";

export default function ServiceCard({ service, index = 0 }) {
  return (
    <Link
      to={`/services/${service.slug}`}
      className="group relative card flex h-full flex-col overflow-hidden p-8 hover:-translate-y-1.5 hover:shadow-soft"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-colors group-hover:bg-primary/15" />
      <div className="relative flex flex-1 flex-col">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary-gradient group-hover:text-white group-hover:shadow-glow">
          <Icon name={service.icon} className="h-7 w-7" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">From {service.priceFrom}</span>
        <h3 className="heading-md mt-1 text-ink group-hover:text-primary transition-colors">{service.name}</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">{service.short}</p>
        <div className="mt-4 flex items-center gap-2 pt-2 font-semibold text-primary">
          Learn more <FaArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}