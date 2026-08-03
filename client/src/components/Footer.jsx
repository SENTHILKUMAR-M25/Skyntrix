import { Link } from "react-router-dom";
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebookF, FaDribbble, FaPhone, FaEnvelope, FaLocationDot } from "react-icons/fa6";
import Logo from "./Logo";
import Newsletter from "./Newsletter";
import { SITE } from "../config/site";
import { useSiteData } from "../lib/SiteDataContext";

const fallbackServices = [
  { label: "Website Development", slug: "website-development" },
  { label: "Mobile App Development", slug: "mobile-app-development" },
  { label: "UI/UX Design", slug: "ui-ux-design" },
  { label: "Social Media Marketing", slug: "social-media-marketing" },
  { label: "Poster Designing", slug: "poster-designing" },
  { label: "Branding", slug: "branding" },
  { label: "SEO", slug: "seo" },
  { label: "Website Maintenance", slug: "website-maintenance" }
];

const quick = [
  { label: "About Us", to: "/about" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Pricing", to: "/pricing" },
  // { label: "Blog", to: "/blog" },
  // { label: "Careers", to: "/careers" },
  { label: "Contact", to: "/contact" }
];

const socials = [
  { icon: FaLinkedin, href: SITE.social.linkedin, label: "LinkedIn" },
  { icon: FaXTwitter, href: SITE.social.twitter, label: "Twitter" },
  { icon: FaInstagram, href: SITE.social.instagram, label: "Instagram" },
  { icon: FaFacebookF, href: SITE.social.facebook, label: "Facebook" },
  { icon: FaDribbble, href: SITE.social.dribbble, label: "Dribbble" }
];

export default function Footer() {
  const { data } = useSiteData();
  const services = (data?.services || []).map((s) => ({ label: s.name, slug: s.slug }));
  const list = services.length ? services : fallbackServices;
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      <div className="container-x relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo dark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              {SITE.tagline}. We design, build and grow premium digital experiences for startups, SMBs and enterprises worldwide.
            </p>
            <div className="mt-5 flex gap-3">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-primary-gradient hover:text-white">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white/80">Services</h4>
            <ul className="mt-5 space-y-2.5">
              {list.map((s) => (
                <li key={s.slug}><Link to={`/services/${s.slug}`} className="text-sm text-white/60 transition-colors hover:text-white">{s.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white/80">Company</h4>
            <ul className="mt-5 space-y-2.5">
              {quick.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-sm text-white/60 transition-colors hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white/80">Get in Touch</h4>
            <ul className="mt-5 space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-3"><FaLocationDot className="mt-0.5 text-primary-400" /><span>{SITE.address}</span></li>
              <li className="flex items-center gap-3"><FaPhone className="text-primary-400" /><a href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`} className="hover:text-white">{SITE.phone}</a></li>
              <li className="flex items-center gap-3"><FaEnvelope className="text-primary-400" /><a href={`mailto:${SITE.email}`} className="hover:text-white">{SITE.email}</a></li>
            </ul>
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">Newsletter</p>
              <Newsletter />
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center text-xs text-white/50 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white">Terms &amp; Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}