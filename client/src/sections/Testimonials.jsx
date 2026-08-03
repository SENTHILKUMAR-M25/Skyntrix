import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import TestimonialCard from "../components/TestimonialCard";
import { useSiteData } from "../lib/SiteDataContext";

export default function Testimonials() {
  const { data } = useSiteData();
  const testimonials = data?.testimonials || [];
  return (
    <section className="section-pad bg-base">
      <div className="container-x">
        <SectionHeading
          label="Testimonials"
          title="Clients Who Trusted Us — And Grew"
          subtitle="Don't take our word for it. Here's what founders and leaders say about working with Skyntrix."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.author} delay={i * 0.06}><TestimonialCard t={t} /></Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}