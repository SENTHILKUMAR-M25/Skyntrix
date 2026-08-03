import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import SectionHeading from "../components/SectionHeading";
import ProjectCard from "../components/ProjectCard";
import Reveal from "../components/Reveal";
import { useSiteData } from "../lib/SiteDataContext";

export default function FeaturedProjects() {
  const { data } = useSiteData();
  const featured = (data?.projects || []).filter((p) => p.featured).slice(0, 6);
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="Case Studies"
          title="Work That Speaks for Itself"
          subtitle="A snapshot of products we've designed and built — each one engineered to deliver measurable business outcomes."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
        <Reveal className="mt-12 text-center">
          <Link to="/portfolio" className="btn-primary">View Full Portfolio <FaArrowRight /></Link>
        </Reveal>
      </div>
    </section>
  );
}