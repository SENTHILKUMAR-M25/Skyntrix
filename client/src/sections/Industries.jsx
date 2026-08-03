import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import { Icon } from "../components/icons";
import { industries } from "../data/portfolio";

export default function Industries() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="Industries"
          title="Deep Expertise Across Every Sector"
          subtitle="From healthcare to hospitality, we understand the unique digital challenges of your industry."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {industries.map((ind, i) => (
            <Reveal key={ind.name} delay={i * 0.04}>
              <div className="card group flex flex-col items-center gap-3 p-6 text-center hover:-translate-y-1 hover:shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-all group-hover:bg-primary-gradient group-hover:text-white">
                  <Icon name={ind.icon} className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold text-ink">{ind.name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}