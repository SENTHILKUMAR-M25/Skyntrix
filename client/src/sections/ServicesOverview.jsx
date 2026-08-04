import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import SectionHeading from "../components/SectionHeading";
import ServiceCard from "../components/ServiceCard";
import Reveal from "../components/Reveal";
import { useSiteData } from "../lib/SiteDataContext";

export default function ServicesOverview() {
  const { data } = useSiteData();
  const services = (data?.services || []).slice(0, 8);
  const items = [...services, ...services];

  return (
    <section className="section-pad bg-white overflow-hidden">
      <div className="container-x">
        <SectionHeading
          label="Our Services"
          title="Full-Stack Digital Solutions Under One Roof"
          subtitle="From your first idea to a scalable, revenue-generating product — we cover everything with a single, accountable partner."
        />
      </div>

      <div className="relative mt-12 group/marquee">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

        <div className="marquee-track flex w-max gap-6 py-2">
          {items.map((s, i) => (
            <div key={`${s.slug}-${i}`} className="shrink-0 w-[300px]">
              <ServiceCard service={s} />
            </div>
          ))}
        </div>
      </div>

      <Reveal className="mt-12 text-center">
        <Link to="/services" className="btn-secondary">Explore All Services <FaArrowRight className="h-4 w-4" /></Link>
      </Reveal>

      <style>{`
        .marquee-track {
          animation: marquee-scroll 30s linear infinite;
        }
        .group\/marquee:hover .marquee-track {
          animation-play-state: paused;
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}