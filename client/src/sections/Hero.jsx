import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FaArrowRight, FaPlay, FaStar, FaRocket } from "react-icons/fa6";
import { useConsult } from "../components/ConsultModal";

const floating = [
  { icon: "fa-star", label: "4.9 Rating", x: "80%", y: "18%", d: 0 },
  { icon: "fa-projects", label: "120+ Projects", x: "45%", y: "22%", d: 0.6 },
  { icon: "fa-years", label: "6+ Years", x: "88%", y: "62%", d: 1.1 },
  { icon: "fa-support", label: "24/7 Support", x: "50%", y: "75%", d: 1.5 }
];

export default function Hero() {
  const { openConsult } = useConsult();

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-[480px] w-[480px] animate-blob rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-20 right-0 h-[420px] w-[420px] animate-blob rounded-full bg-secondary/15 blur-3xl [animation-delay:3s]" />
        <div className="absolute inset-0 bg-grid opacity-[0.35]" />
      </div>

      {/* Floating web cards */}
      {floating.map((f) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: f.d + 0.6 }}
          className="glass absolute z-10 hidden lg:flex items-center gap-2 rounded-2xl px-4 py-3 shadow-soft animate-float"
          style={{ left: f.x, top: f.y, animationDelay: `${f.d}s` }}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient text-white"><FaStar /></span>
          <span className="text-sm font-semibold text-ink">{f.label}</span>
        </motion.div>
      ))}

      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-primary">
              <FaRocket className="h-3.5 w-3.5" /> Award-winning IT &amp; Digital Agency
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="heading-xl mt-6"
          >
            Building Digital Experiences That <span className="text-gradient">Drive Growth</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg text-ink/60"
          >
            We design, develop and scale premium websites, mobile apps and digital brands for startups and enterprises worldwide — engineered for speed, SEO and conversions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <button onClick={openConsult} className="btn-primary">
              Get Free Consultation <FaArrowRight />
            </button>
            <Link to="/portfolio" className="btn-secondary">
              <FaPlay className="h-3.5 w-3.5" /> View Our Work
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center gap-6"
          >
            <div className="flex -space-x-3">
              {["A", "P", "I", "S"].map((c, i) => (
                <span key={i} className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-primary-gradient font-bold text-white">
                  {c}
                </span>
              ))}
            </div>
            <div>
              <div className="flex text-amber-400">{[...Array(5)].map((_, i) => <FaStar key={i} className="h-4 w-4" />)}</div>
              <p className="mt-1 text-sm text-ink/60">Loved by 80+ clients worldwide</p>
            </div>
          </motion.div>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto w-full max-w-xl"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-primary-gradient opacity-10 blur-3xl" />
          <div className="rounded-3xl border border-white/40 bg-white/60 p-3 shadow-soft backdrop-blur-xl">
            <div className="rounded-2xl bg-primary-gradient p-8 md:p-10">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Project Dashboard</span>
                <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-green-400" /><span className="h-2.5 w-2.5 rounded-full bg-white/40" /></span>
              </div>
              <div className="mt-8 space-y-4">
                {[
                  ["Website Development", 90, "from-white/70 to-white"],
                  ["Mobile App", 78, "from-white/50 to-white/70"],
                  ["UI/UX Design", 94, "from-white/80 to-white"],
                  ["SEO & Growth", 85, "from-white/60 to-white/80"]
                ].map(([label, val, grad]) => (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between text-sm font-medium text-white">
                      <span>{label}</span><span>{val}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/20">
                      <div className={`h-2 rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-ink/50">Monthly Growth</p>
                    <p className="font-display text-2xl font-bold text-ink">+158%</p>
                  </div>
                  <div className="h-12 w-24 bg-gradient-to-t from-primary/20 to-secondary/20 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}