import { FaCheck } from "react-icons/fa6";
import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import FAQ from "../components/FAQ";
import CtaSection from "../components/CtaSection";
import { useConsult } from "../components/ConsultModal";
import { pricing, addons } from "../data/pricing";

const faqs = [
  { q: "What's included in the starting price?", a: "Starting prices cover scoped baseline packages. Every project is unique, so we provide a detailed, transparent quote after understanding your requirements." },
  { q: "Can I customise a package?", a: "Absolutely. Mix, match, and scale any package to fit your goals and budget. Our team will tailor the perfect scope for you." },
  { q: "Are there any hidden costs?", a: "No. We're fully transparent about pricing, and any third-party costs (hosting, domains, licenses) are clearly itemised upfront." },
  { q: "Do you offer payment plans?", a: "Yes, we structure payments into milestones so you can start with confidence and pay as we deliver value." },
  { q: "What if I need ongoing support?", a: "We offer flexible maintenance and growth plans to keep your product fast, secure and evolving." }
];

export default function Pricing() {
  const { openConsult } = useConsult();
  return (
    <>
      <Seo title="Pricing" path="/pricing" description="Transparent, flexible pricing packages from Skyntrix. Find the perfect plan for your website, app or digital growth." />
      <PageHero title="Simple, Transparent Pricing" subtitle="Flexible packages designed to scale with your goals. No hidden fees, no surprises." crumb="Pricing" />

      <section className="section-pad bg-base">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
            {pricing.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.05}>
                <div className={`relative flex h-full flex-col rounded-3xl p-8 ${p.featured ? "bg-primary-gradient text-white shadow-soft scale-[1.02]" : "card"}`}>
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">Most Popular</span>
                  )}
                  <h3 className={`heading-md ${p.featured ? "text-white" : "text-ink"}`}>{p.name}</h3>
                  <p className={`mt-2 text-sm ${p.featured ? "text-white/80" : "text-ink/55"}`}>{p.tagline}</p>
                  <div className="mt-6 flex items-end gap-2">
                    <span className={`font-display text-2xl font-extrabold leading-tight sm:text-3xl ${p.featured ? "text-white" : "text-primary"}`}>{p.price}</span>
                    {p.period && <span className={`pb-1 text-sm ${p.featured ? "text-white/70" : "text-ink/50"}`}>/ {p.period}</span>}
                  </div>
                  <div className="my-6 h-px bg-current opacity-10" />
                  <ul className="flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className={`flex items-start gap-3 text-sm ${p.featured ? "text-white/90" : "text-ink/75"}`}>
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${p.featured ? "bg-white/25" : "bg-primary-gradient"}`}><FaCheck className="h-2.5 w-2.5" /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={openConsult} className={`mt-8 w-full rounded-full py-3 font-semibold transition-transform hover:-translate-y-0.5 ${p.featured ? "bg-white text-primary" : "bg-primary-gradient text-white"}`}>
                    {p.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Addons */}
          <Reveal className="mt-16">
            <h2 className="heading-lg mb-8 text-center">Popular Add-Ons</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {addons.map((a) => (
                <div key={a.name} className="card flex items-center justify-between p-5">
                  <div className="text-sm font-semibold text-ink">{a.name}</div>
                  <div className="text-primary font-bold">{a.price}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad pt-0 bg-base">
        <div className="container-x">
          <Reveal className="mb-10 text-center"><span className="label">FAQ</span><h2 className="heading-lg mt-4">Pricing Questions</h2></Reveal>
          <FAQ items={faqs} />
        </div>
      </section>
      <CtaSection title="Need a custom quote?" subtitle="Tell us about your project and we'll craft a tailored package within 24 hours." />
    </>
  );
}