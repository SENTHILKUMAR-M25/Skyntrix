import { useParams, Link } from "react-router-dom";
import { FaArrowRight, FaCheck, FaChevronLeft } from "react-icons/fa6";
import { motion } from "framer-motion";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import FAQ from "../components/FAQ";
import LeadForm from "../components/LeadForm";
import { Icon } from "../components/icons";
import { useSiteData } from "../lib/SiteDataContext";

export default function ServiceDetail() {
  const { slug } = useParams();
  const { data, loading } = useSiteData();
  const services = data?.services || [];
  const service = services.find((s) => s.slug === slug) || services[0];

  if (loading && !service) {
    return (
      <>
        <Seo title="Services" path={`/services/${slug}`} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!service) {
    return (
      <>
        <Seo title="Service not found" path={`/services/${slug}`} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="heading-lg text-ink">Service not found</h1>
          <Link to="/services" className="btn-primary mt-6">Back to Services</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo
        title={service.name}
        path={`/services/${slug}`}
        description={service.short}
      />
      <section className="relative overflow-hidden bg-ink pt-36 pb-20 text-white md:pt-44">
        <div className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        <div className="container-x relative grid items-center gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/services" className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><FaChevronLeft className="h-3 w-3" /> Back to Services</Link>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <Icon name={service.icon} className="h-4 w-4 text-accent" /> Starting {service.priceFrom}
            </span>
            <h1 className="heading-xl mt-5">{service.name}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/70">{service.overview}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {service.technologies.map((t) => (
                <span key={t} className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-medium backdrop-blur">{t}</span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-gradient text-white"><Icon name={service.icon} className="h-6 w-6" /></span>
              <div>
                <h3 className="font-display text-lg font-bold">Request a Quote</h3>
                <p className="text-sm text-white/60">Get a free, detailed estimate</p>
              </div>
            </div>
            <div className="[&_input]:!bg-white/5 [&_input]:!text-white [&_select]:!bg-white/5 [&_select]:!text-white [&_select>*]:!text-ink [&_textarea]:!bg-white/5 [&_textarea]:!text-white [&_textarea]:placeholder:text-white/40">
              <LeadForm compact defaultService={service.name} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features & Benefits */}
      <section className="section-pad bg-base">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <Reveal>
            <span className="label">Features</span>
            <h2 className="heading-lg mt-4">What's Included</h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {service.features.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
                  <FaCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium text-ink">{f}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <span className="label">Benefits</span>
            <h2 className="heading-lg mt-4">Why You'll Love It</h2>
            <div className="mt-7 space-y-3">
              {service.benefits.map((b) => (
                <div key={b} className="rounded-xl border border-primary/15 bg-white p-4">
                  <p className="text-sm font-medium text-ink/80">✓ {b}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Workflow */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <Reveal className="text-center mb-14"><span className="label">Our Workflow</span><h2 className="heading-lg mt-4">How We Deliver</h2></Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {service.workflow.map((w, i) => (
              <Reveal key={w.step} delay={i * 0.08} className="h-full">
                <div className="card flex h-full flex-col p-7 text-center hover:-translate-y-1 hover:shadow-soft">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-gradient font-display font-bold text-white">{w.step}</span>
                  <h3 className="heading-md mt-4 text-ink">{w.title}</h3>
                  <p className="mt-2 text-sm text-ink/55">{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-pad bg-base">
        <div className="container-x">
          <Reveal className="text-center mb-14"><span className="label">FAQ</span><h2 className="heading-lg mt-4">Frequently Asked Questions</h2></Reveal>
          <FAQ items={service.faqs} />
        </div>
      </section>

      {/* Other services */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <Reveal className="mb-10 text-center"><h2 className="heading-lg">Explore More Services</h2></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.filter((s) => s.slug !== slug).slice(0, 4).map((s) => (
              <Link key={s.slug} to={`/services/${s.slug}`} className="card group flex items-center justify-between gap-3 p-5 hover:-translate-y-1 hover:shadow-soft">
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary-gradient group-hover:text-white"><Icon name={s.icon} /></span>
                  <span className="text-sm font-semibold text-ink">{s.name}</span>
                </span>
                <FaArrowRight className="text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}