import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import TestimonialCard from "../components/TestimonialCard";
import { useSiteData } from "../lib/SiteDataContext";

export default function Testimonials() {
  const { data } = useSiteData();
  const testimonials = data?.testimonials || [];
  const items = [...testimonials, ...testimonials];

  return (
    <section className="section-pad bg-base overflow-hidden">
      <div className="container-x">
        <SectionHeading
          label="Testimonials"
          title="Clients Who Trusted Us — And Grew"
          subtitle="Don't take our word for it. Here's what founders and leaders say about working with Skyntrix."
        />
      </div>

      {/* Mobile auto-scroll carousel */}
      <div className="relative mt-12 group/marquee sm:hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-base to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-base to-transparent z-10" />
        <div className="marquee-testimonials flex w-max gap-6 py-2">
          {items.map((t, i) => (
            <div key={`${t.author}-${i}`} className="shrink-0 w-[300px]">
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden sm:block">
        <div className="container-x">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.author} delay={i * 0.06}><TestimonialCard t={t} /></Reveal>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .marquee-testimonials {
          animation: marquee-testimonials-scroll 28s linear infinite;
        }
        .group\/marquee:hover .marquee-testimonials {
          animation-play-state: paused;
        }
        @keyframes marquee-testimonials-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}