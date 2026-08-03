import { FaStar, FaQuoteLeft } from "react-icons/fa6";

export default function TestimonialCard({ t }) {
  return (
    <div className="card relative h-full p-8">
      <FaQuoteLeft className="absolute right-6 top-6 h-10 w-10 text-primary/10" />
      <div className="mb-4 flex text-amber-400">
        {[...Array(5)].map((_, i) => <FaStar key={i} className="h-4 w-4" />)}
      </div>
      <p className="text-ink/75 leading-relaxed">"{t.quote}"</p>
      <div className="mt-6 flex items-center gap-3 border-t border-ink/10 pt-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-gradient font-bold text-white">
          {t.avatar}
        </span>
        <div>
          <div className="font-semibold text-ink">{t.author}</div>
          <div className="text-sm text-ink/55">{t.role}</div>
        </div>
      </div>
    </div>
  );
}