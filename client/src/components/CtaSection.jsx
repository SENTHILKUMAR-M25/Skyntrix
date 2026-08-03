import { FaArrowRight, FaPhone } from "react-icons/fa6";
import { useConsult } from "./ConsultModal";
import { SITE } from "../config/site";
import Reveal from "./Reveal";

export default function CtaSection({ title = "Ready to Build Your Digital Growth Story?", subtitle = "Let's turn your vision into a premium product that converts. Get a free, no-obligation consultation today." }) {
  const { openConsult } = useConsult();
  return (
    <section className="section-pad">
      <Reveal className="container-x">
        <div className="relative overflow-hidden rounded-3xl bg-primary-gradient p-10 text-center md:p-16 shadow-soft">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="heading-lg text-white">{title}</h2>
            <p className="mt-4 text-lg text-white/85">{subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button onClick={openConsult} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-primary shadow-soft transition-transform hover:scale-105">
                Get Free Consultation <FaArrowRight />
              </button>
              <a href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`} className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10">
                <FaPhone /> Call Us Now
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}