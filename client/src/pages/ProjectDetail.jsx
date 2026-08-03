import { useParams, Link } from "react-router-dom";
import { FaChevronLeft, FaArrowRight, FaClock, FaTag, FaBriefcase, FaBuilding, FaUsers } from "react-icons/fa6";
import Reveal from "../components/Reveal";
import Seo from "../components/Seo";
import CtaSection from "../components/CtaSection";
import ProjectVisual from "../components/ProjectVisual";
import { useSiteData } from "../lib/SiteDataContext";

export default function ProjectDetail() {
  const { slug } = useParams();
  const { data, loading } = useSiteData();
  const projects = data?.projects || [];
  const project = projects.find((p) => p.slug === slug) || projects[0];
  const related = project ? projects.filter((p) => p.category === project.category && p.id !== project.id).slice(0, 3) : [];

  if (loading && !project) {
    return (
      <>
        <Seo title="Portfolio" path={`/portfolio/${slug}`} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Seo title="Project not found" path={`/portfolio/${slug}`} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="heading-lg text-ink">Project not found</h1>
          <Link to="/portfolio" className="btn-primary mt-6">Back to Portfolio</Link>
        </div>
      </>
    );
  }

  const facts = [
    { icon: FaBriefcase, label: "Client", value: project.client },
    { icon: FaClock, label: "Duration", value: project.duration },
    { icon: FaBuilding, label: "Industry", value: project.industry },
    { icon: FaTag, label: "Category", value: project.category },
  ];

  return (
    <>
      <Seo title={project.title} path={`/portfolio/${slug}`} description={project.overview} type="article" />
      <section className="relative overflow-hidden bg-ink pt-36 pb-20 text-white md:pt-44">
        <div className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        <div className="container-x relative">
          <Link to="/portfolio" className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><FaChevronLeft className="h-3 w-3" /> Back to Portfolio</Link>
          <h1 className="heading-xl max-w-3xl">{project.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">{project.overview}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {project.technologies?.map((t) => (
              <span key={t} className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm backdrop-blur">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <Reveal className="relative z-10 -mt-14 px-4">
        <div className="container-x">
          <ProjectVisual image={project.image} label={project.title} className="h-64 rounded-3xl shadow-soft md:h-[26rem]" />
        </div>
      </Reveal>

      <section className="section-pad bg-base">
        <div className="container-x">
          {/* <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {facts.map((f) => (
              <div key={f.label} className="card p-6 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
                <div className="mt-3 text-xs uppercase tracking-wide text-ink/50">{f.label}</div>
                <div className="mt-1 font-semibold text-ink">{f.value}</div>
              </div>
            ))}
          </div> */}


          <div className="flex flex-wrap justify-center gap-4">
  {facts.map((f) => (
    <div
      key={f.label}
      className="card flex w-40 flex-col items-center p-6 text-center"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <f.icon className="h-5 w-5" />
      </span>

      <div className="mt-3 text-xs uppercase tracking-wide text-ink/50">
        {f.label}
      </div>

      <div className="mt-1 font-semibold text-ink">
        {f.value}
      </div>
    </div>
  ))}
</div>

          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <Reveal>
              <h2 className="heading-md text-ink">The Challenge</h2>
              <p className="mt-4 leading-relaxed text-ink/60">{project.problem}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="heading-md text-ink">Our Solution</h2>
              <p className="mt-4 leading-relaxed text-ink/60">{project.solution}</p>
            </Reveal>
          </div>

          {project.results && (
            <Reveal className="mt-12">
              <div className="rounded-3xl bg-primary-gradient p-10 text-center text-white">
                <h3 className="heading-md">The Results</h3>
                <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">{project.results}</p>
              </div>
            </Reveal>
          )}

          {project.testimonial && (
            <Reveal className="mt-12">
              <div className="card relative p-10">
                <span className="absolute -top-5 left-10 grid h-10 w-10 place-items-center rounded-xl bg-primary-gradient font-display text-2xl text-white">"</span>
                <p className="text-lg italic text-ink/75">{project.testimonial.quote}</p>
                <div className="mt-4 font-semibold text-ink">{project.testimonial.author} <span className="font-normal text-ink/50">— {project.testimonial.role}</span></div>
              </div>
            </Reveal>
          )}

          <Reveal className="mt-10 flex flex-wrap justify-center gap-4">
            {project.liveDemo && project.liveDemo !== "#" && (
              <a href={project.liveDemo} target="_blank" rel="noreferrer" className="btn-primary">View Live Demo <FaArrowRight /></a>
            )}
            <Link to="/contact" className="btn-secondary">Start a Similar Project</Link>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-pad bg-white pt-0">
          <div className="container-x">
            <Reveal className="mb-8"><h2 className="heading-lg">More Like This</h2></Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.05}>
                  <Link to={`/portfolio/${p.slug}`} className="card block p-6 transition-all hover:-translate-y-1 hover:shadow-soft">
                    <div className="text-xs font-semibold text-primary">{p.category}</div>
                    <h3 className="mt-2 font-display text-lg font-bold text-ink">{p.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-ink/55">{p.overview}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaSection />
    </>
  );
}