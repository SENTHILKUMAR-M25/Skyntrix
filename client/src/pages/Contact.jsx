import { FaEnvelope, FaPhone, FaLocationDot, FaClock } from "react-icons/fa6";
import { SITE } from "../config/site";
import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import LeadForm from "../components/LeadForm";
import Reveal from "../components/Reveal";

const contactItems = [
  { icon: FaEnvelope, label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
  { icon: FaPhone, label: "Phone", value: SITE.phone, href: `tel:${SITE.phone.replace(/\s/g, "")}` },
  { icon: FaLocationDot, label: "Address", value: SITE.address },
  { icon: FaClock, label: "Hours", value: SITE.hours },
];

export default function Contact() {
  return (
    <>
      <Seo title="Contact" path="/contact" description="Get in touch with Skyntrix — share your project goals and we'll respond within one business day." />
      <PageHero title="Let's Talk" subtitle="Tell us about your project, your goals and your timeline. We're here to help you build something exceptional." crumb="Contact" />

      <section className="section-pad bg-base">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-bold text-ink">Get in Touch</h2>
              <p className="text-ink/60">Have a project in mind or a question? Drop us a line — our team typically responds within one business day.</p>
              <div className="space-y-4">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-lg text-white"><Icon /></span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{item.label}</p>
                        {item.href ? <a href={item.href} className="font-medium text-ink transition-colors hover:text-primary">{item.value}</a> : <p className="font-medium text-ink">{item.value}</p>}
                      </div>
                    </div>
                  );
                  return <Reveal key={item.label}>{content}</Reveal>;
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card p-6 sm:p-8">
              <h3 className="mb-6 font-display text-xl font-bold text-ink">Send an Inquiry</h3>
              <LeadForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}