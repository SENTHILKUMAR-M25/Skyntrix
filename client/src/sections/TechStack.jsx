import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import { Icon } from "../components/icons";
import { techStack } from "../data/content";

export default function TechStack() {
  return (
    <section className="section-pad bg-base">
      <div className="container-x">
        <SectionHeading
          label="Technology Stack"
          title="Modern Tools. Battle-Tested Stack."
          subtitle="We use industry-leading, scalable technologies that keep your product fast, secure and future-proof."
        />
        <div className="relative overflow-hidden">
          <div className="flex w-max gap-4 animate-marquee hover:[animation-play-state:paused]">
            {[...techStack, ...techStack].map((t, i) => (
              <div key={i} className="card flex shrink-0 items-center gap-3 px-6 py-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon name={t.icon} className="h-5 w-5" /></span>
                <div>
                  <div className="font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-ink/50">{t.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6 text-center">
          {["Frontend", "Backend", "Database", "Animation", "Payments"].map((c) => (
            <div key={c} className="rounded-xl border border-ink/5 bg-white px-4 py-3 text-sm font-medium text-ink/60">{c}</div>
          ))}
        </div>
      </div>
    </section>
  );
}