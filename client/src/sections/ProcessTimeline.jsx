import { useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import { process } from "../data/content";

export default function ProcessTimeline() {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="Our Process"
          title="A Proven Path From Idea to Impact"
          subtitle="Transparent, agile and predictable. This is exactly how we take your project from concept to launch and beyond."
        />

        {/* Mobile carousel */}
        <div className="relative group/carousel md:hidden">
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-ink/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:text-primary hover:shadow-lg cursor-pointer"
            aria-label="Scroll left"
          >
            <FaChevronLeft className="h-4 w-4" />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {process.map((p, i) => (
              <Reveal key={p.step} delay={i * 0.08}>
                <div className="snap-start shrink-0 w-[260px] relative p-2 text-center">
                  <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary-gradient font-display text-xl font-bold text-white shadow-soft">
                    {p.step}
                  </div>
                  <h3 className="heading-md text-ink">{p.title}</h3>
                  <p className="mt-3 text-ink/60 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-ink/60 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:text-primary hover:shadow-lg cursor-pointer"
            aria-label="Scroll right"
          >
            <FaChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop grid */}
        <div className="relative hidden gap-6 md:grid md:grid-cols-3">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 md:block" />
          {process.map((p, i) => (
            <Reveal key={p.step} delay={i * 0.08}>
              <div className="relative p-2 text-left">
                <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary-gradient font-display text-xl font-bold text-white shadow-soft">
                  {p.step}
                </div>
                <h3 className="heading-md text-ink">{p.title}</h3>
                <p className="mt-3 text-ink/60 leading-relaxed">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}