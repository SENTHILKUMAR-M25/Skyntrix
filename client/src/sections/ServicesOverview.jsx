import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import SectionHeading from "../components/SectionHeading";
import ServiceCard from "../components/ServiceCard";
import Reveal from "../components/Reveal";
import { useSiteData } from "../lib/SiteDataContext";

export default function ServicesOverview() {
  const { data } = useSiteData();
  const services = data?.services || [];
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="Our Services"
          title="Full-Stack Digital Solutions Under One Roof"
          subtitle="From your first idea to a scalable, revenue-generating product — we cover everything with a single, accountable partner."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 8).map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.06} className="h-full">
              <ServiceCard service={s} />
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12 text-center">
          <Link to="/services" className="btn-secondary">Explore All Services <FaArrowRight className="h-4 w-4" /></Link>
        </Reveal>
      </div>
    </section>
  );
}