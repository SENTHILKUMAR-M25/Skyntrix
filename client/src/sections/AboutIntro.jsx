import { Link } from "react-router-dom";
import { FaCheck } from "react-icons/fa6";
import Reveal from "../components/Reveal";
import { useConsult } from "../components/ConsultModal";

const points = [
  "Strategic brand & product thinking",
  "Award-worthy, pixel-perfect design",
  "Performance, SEO & accessibility first",
  "Transparent pricing & weekly demos"
];

export default function AboutIntro() {
  const { openConsult } = useConsult();
  return (
    <section className="section-pad bg-base">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="label">Who We Are</span>
          <h2 className="heading-lg mt-4">A Full Service Digital Partner for Ambitious Brands</h2>
          <p className="mt-5 text-ink/60 leading-relaxed">
            Skyntrix Technologies is a team of designers, engineers and growth specialists on a mission to help businesses
            win online. We combine premium design, robust engineering and data-driven marketing to build digital products
            that don't just look great — they perform.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-gradient text-white"><FaCheck className="h-3 w-3" /></span>
                <span className="text-ink/75">{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={openConsult} className="btn-primary">Start Your Project</button>
            <Link to="/about" className="btn-ghost">More About Us</Link>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-secondary/10 blur-3xl" />
            <div className="rounded-3xl border border-white/40 bg-white p-6 shadow-soft backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-gradient font-bold text-white">98%</span>
                <div>
                  <h3 className="font-semibold text-ink">Client Satisfaction</h3>
                  <p className="text-sm text-ink/50">Across 80+ happy clients</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  ["120+", "Projects"],
                  ["10+", "Countries"],
                  ["6+", "Years"]
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-base py-4">
                    <div className="font-display text-2xl font-bold text-gradient">{v}</div>
                    <div className="text-xs text-ink/50">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["Product Strategy", 92],
                  ["Brand & UI/UX", 95],
                  ["Engineering", 90],
                  ["Growth & SEO", 88]
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-ink/60"><span>{label}</span><span>{val}%</span></div>
                    <div className="h-2 rounded-full bg-primary/10"><div className="h-2 rounded-full bg-primary-gradient" style={{ width: `${val}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}