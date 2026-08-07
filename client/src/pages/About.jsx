import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import Stats from "../sections/Stats";
import CtaSection from "../components/CtaSection";
import { values, timeline } from "../data/content";
import { useSiteData } from "../lib/SiteDataContext";

const achievements = [
  { value: "4", label: "Dedicated Team Members" },
  { value: "2026", label: "Founded" },
  { value: "100%", label: "Client-Focused Approach" },
  { value: "24/7", label: "Support & Communication" }
];
const certifications = [
  "Modern Web Technologies",
  "Mobile App Development",
  "UI/UX Design Standards",
  "SEO Best Practices",
  "Cloud Deployment Ready"
];

export default function About() {
  const { data } = useSiteData();
  const team = data?.team || [];
  return (
    <>
      <Seo title="About Us" path="/about" description="Learn the story, mission, values and people behind Skyntrix Technologies — an award-winning digital agency." />
      <PageHero title="About Skyntrix" subtitle="The people, craft and values behind the brands we grow." crumb="About" />

      {/* Story + Mission */}
      <section className="section-pad bg-base">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="label">Our Story</span>
            <h2 className="heading-lg mt-4">
              Building the Future, One Digital Solution at a Time
            </h2>

            <div className="mt-5 space-y-4 text-ink/60 leading-relaxed">
              <p>
                Skyntrix Technologies is a newly launched digital agency founded in 2026
                with a mission to help businesses establish a strong digital presence
                through innovative websites, mobile applications, branding, and digital
                marketing solutions.
              </p>

              <p>
                Although we are at the beginning of our journey, our passionate team of
                four professionals combines creativity, modern technologies, and
                customer-focused thinking to deliver reliable, scalable, and high-quality
                digital solutions for startups and growing businesses.
              </p>

              <p>
                We believe every successful company deserves a powerful digital identity,
                and we're committed to becoming a trusted technology partner for businesses
                looking to grow in the digital world.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {achievements.map((a) => (
                <div key={a.label} className="rounded-2xl bg-white p-4 text-center shadow-card">
                  <div className="font-display text-2xl font-bold text-gradient">{a.value}</div>
                  <div className="mt-1 text-xs text-ink/50">{a.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="space-y-5">
              <div className="card p-8">
                <h3 className="heading-md text-ink">Our Mission</h3>
                <p className="mt-3 text-ink/60">
                  Our mission is to empower startups and businesses with modern digital
                  solutions that are visually engaging, technically reliable, and designed
                  to drive real business growth.
                </p>
              </div>
              <div className="card p-8">
                <h3 className="heading-md text-ink">Our Vision</h3>
                <p className="mt-3 text-ink/60">
                  Our vision is to become a trusted digital technology partner by delivering
                  innovative websites, mobile applications, branding, and marketing solutions
                  that create lasting value for our clients.
                </p>
              </div>
              <div className="card relative overflow-hidden bg-primary-gradient p-8 text-white">
                <div className="pointer-events-none absolute inset-0 bg-white/5" />
                <h3 className="heading-md relative">Founder's Message</h3>
                <p className="relative mt-3 text-white/85">"We founded Skyntrix Technologies with a simple vision—to help businesses
                  transform their ideas into meaningful digital experiences. Every project we
                  take on is treated as a partnership, and our goal is to deliver solutions
                  that create long-term value for our clients."
                  </p>
                <div className="relative mt-4 font-semibold">— Arjun M., Founder &amp; CEO</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Core values */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <SectionHeading label="Core Values" title="The Principles That Guide Everything We Do" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.05}>
                <div className="card h-full p-8 hover:-translate-y-1 hover:shadow-soft">
                  <span className="mb-4 inline-block rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="heading-md text-ink">{v.title}</h3>
                  <p className="mt-3 text-ink/60">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section-pad bg-base">
        <div className="container-x">
          <SectionHeading label="Our Journey" title="Milestones That Shaped Skyntrix" />
          <div className="relative mx-auto max-w-3xl pl-8">
            <div className="absolute left-3 top-0 h-full w-px bg-gradient-to-b from-primary to-secondary" />
            {timeline.map((t, i) => (
              <Reveal key={t.year} delay={i * 0.05}>
                <div className="relative mb-8 pl-6">
                  <span className="absolute -left-[29px] top-1 h-5 w-5 rounded-full bg-primary-gradient ring-4 ring-white" />
                  <div className="card p-6">
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{t.year}</span>
                    <h3 className="mt-2 heading-md text-lg text-ink">{t.title}</h3>
                    <p className="mt-1 text-ink/60">{t.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

       {/* Team */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <SectionHeading label="Our Team" title="The People Behind the Craft" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.05}>
                <div className="card group h-full overflow-hidden p-8 text-center hover:-translate-y-1 hover:shadow-soft">
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary-gradient font-display text-2xl font-bold text-white shadow-soft transition-transform group-hover:scale-105">
                    {m.avatar}
                  </span>
                  <h3 className="heading-md mt-5 text-ink">{m.name}</h3>
                  <div className="mt-1 text-sm font-semibold text-primary">{m.role}</div>
                  <p className="mt-3 text-sm text-ink/55">{m.bio}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section> 

      {/* Certifications */}
      {/* <section className="section-pad pt-0">
        <div className="container-x">
          <div className="rounded-3xl bg-primary-gradient p-10 text-center text-white">
            <h2 className="heading-lg">Certifications &amp; Recognition</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {certifications.map((c, i) => (
                <span key={c} className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/20">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      <CtaSection title="Let's Write the Next Chapter Together" />
    </>
  );
}