import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import SectionHeading from "../components/SectionHeading";
import ProjectCard from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import { useSiteData } from "../lib/SiteDataContext";

export default function FeaturedProjects() {
  const { data } = useSiteData();
  const featured = (data?.projects || []).filter((p) => p.featured).slice(0, 6);
  const items = [...featured, ...featured];

  return (
    <section className="section-pad bg-white overflow-hidden">
      <div className="container-x">
        <SectionHeading
          label="Case Studies"
          title="Work That Speaks for Itself"
          subtitle="A snapshot of products we've designed and built — each one engineered to deliver measurable business outcomes."
        />
      </div>

      <div className="relative mt-12 group/marquee">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

        <div className="marquee-projects flex w-max gap-6 py-2">
          {items.map((p, i) => (
            <div key={`${p.id}-${i}`} className="shrink-0 w-[340px]">
              <ProjectCard project={p} index={i % featured.length} />
            </div>
          ))}
        </div>
      </div>

      <Reveal className="mt-12 text-center">
        <Link to="/portfolio" className="btn-primary">View Full Portfolio <FaArrowRight /></Link>
      </Reveal>

      <style>{`
        .marquee-projects {
          animation: marquee-projects-scroll 35s linear infinite;
        }
        .group\/marquee:hover .marquee-projects {
          animation-play-state: paused;
        }
        @keyframes marquee-projects-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}