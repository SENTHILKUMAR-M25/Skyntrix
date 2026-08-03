import Reveal from "../components/Reveal";
import { Icon } from "../components/icons";
import SectionHeading from "../components/SectionHeading";
import { whyChooseUs } from "../data/content";

export default function WhyChooseUs() {
  return (
    <section className="section-pad bg-base">
      <div className="container-x">
        <SectionHeading
          label="Why Skyntrix"
          title="A Partner Built for Your Success"
          subtitle="We combine elite design, robust engineering and clear communication to deliver results — not just deliverables."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {whyChooseUs.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.05}>
              <div className="group card h-full p-8 hover:-translate-y-1 hover:shadow-soft">
                <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary transition-all group-hover:bg-primary-gradient group-hover:text-white">
                  <Icon name={w.icon} className="h-7 w-7" />
                </span>
                <h3 className="heading-md text-ink">{w.title}</h3>
                <p className="mt-3 text-ink/60 leading-relaxed">{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}