import Reveal from "./Reveal";

export default function SectionHeading({ label, title, subtitle, center = true, dark = false }) {
  return (
    <Reveal className={center ? "text-center mx-auto max-w-2xl mb-14" : "max-w-2xl mb-14"}>
      {label && <span className="label uppercase tracking-widest text-primary"><span className="h-px w-8 bg-primary/50" />{label}<span className="h-px w-8 bg-primary/50" /></span>}
      <h2 className={`heading-lg mt-4 ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      {subtitle && <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-white/70" : "text-ink/60"}`}>{subtitle}</p>}
    </Reveal>
  );
}