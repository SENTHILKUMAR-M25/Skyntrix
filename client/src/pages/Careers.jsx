import { FaArrowRight, FaLocationDot, FaTag } from "react-icons/fa6";
import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import CtaSection from "../components/CtaSection";

const openings = [
  { title: "Senior Frontend Developer", tags: ["Development", "Full-time"], location: "Remote" },
  { title: "UI/UX Designer", tags: ["Design", "Full-time"], location: "Remote" },
  { title: "SEO Specialist", tags: ["Growth", "Full-time"], location: "Hybrid" },
  { title: "React Developer", tags: ["Development", "Full-time"], location: "Remote" },
];

export default function Careers() {
  return (
    <>
      <Seo title="Careers" path="/careers" description="Join the Skyntrix team — we're always looking for talented designers, developers and strategists." />
      <PageHero title="Join Our Team" subtitle="We build products people love. If you're driven, curious and collaborative, we want to hear from you." crumb="Careers" />

      <section className="section-pad bg-base">
        <div className="container-x">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink">Open Positions</h2>
            <p className="mt-3 text-ink/60">Explore current openings across design, development and growth.</p>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {openings.map((job, i) => (
              <Reveal key={job.title} delay={i * 0.05}>
                <article className="card flex flex-col gap-4 p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink/55">
                      <span className="flex items-center gap-1.5"><FaTag className="h-3 w-3 text-primary" />{job.tags}</span>
                      <span className="flex items-center gap-1.5"><FaLocationDot className="h-3 w-3 text-primary" />{job.location}</span>
                    </div>
                  </div>
                  <button className="inline-flex items-center gap-1.5 rounded-full bg-primary-gradient px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Apply <FaArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              </Reveal>
            ))}
          </div>

          <p className="mt-10 text-center text-ink/50">Don&apos;t see a role that fits? Email us at <a href="mailto:careers@skyntrix.com" className="font-semibold text-primary">careers@skyntrix.com</a>.</p>
        </div>
      </section>
      <CtaSection title="Let's build something great together" subtitle="Partner with us on your next project — book a free consultation today." />
    </>
  );
}