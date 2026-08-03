import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import { process } from "../data/content";

export default function ProcessTimeline() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="Our Process"
          title="A Proven Path From Idea to Impact"
          subtitle="Transparent, agile and predictable. This is exactly how we take your project from concept to launch and beyond."
        />
        <div className="relative grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 md:block" />
          {process.map((p, i) => (
            <Reveal key={p.step} delay={i * 0.08}>
              <div className="relative p-2 text-center md:text-left">
                <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary-gradient font-display text-xl font-bold text-white shadow-soft md:mx-0">
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