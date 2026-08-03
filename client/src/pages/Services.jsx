import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import ServiceCard from "../components/ServiceCard";
import CtaSection from "../components/CtaSection";
import HomeFAQ from "../sections/HomeFAQ";
import { useSiteData } from "../lib/SiteDataContext";

export default function Services() {
  const { data } = useSiteData();
  const services = data?.services || [];
  return (
    <>
      <Seo title="Services" path="/services" description="Explore Skyntrix's full range of digital services: website development, mobile apps, UI/UX, branding, SEO and digital marketing." />
      <PageHero
        title="Our Services"
        subtitle="Everything your business needs to succeed online — design, development, and growth under one accountable partner."
        crumb="Services"
      />
      <section className="section-pad bg-base">
        <div className="container-x grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.05} className="h-full"><ServiceCard service={s} /></Reveal>
          ))}
        </div>
      </section>
      <CtaSection title="Not sure which service you need?" subtitle="Book a free consultation and we'll recommend the right path for your goals and budget." />
    </>
  );
}