import Reveal from "../components/Reveal";
import Counter from "../components/Counter";
import { stats } from "../data/content";

export default function Stats() {
  return (
    <section className="relative overflow-hidden bg-primary-gradient py-16 text-white md:py-20">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="container-x grid grid-cols-2 gap-8 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1} className="text-center">
            <div className="font-display text-4xl font-extrabold md:text-5xl">
              <Counter value={s.value} suffix={s.suffix} />
            </div>
            <p className="mt-2 text-sm font-medium text-white/80 md:text-base">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}