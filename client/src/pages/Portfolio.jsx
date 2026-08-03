import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaMagnifyingGlass } from "react-icons/fa6";
import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import ProjectCard from "../components/ProjectCard";
import CtaSection from "../components/CtaSection";
import { useSiteData } from "../lib/SiteDataContext";

export default function Portfolio() {
  const { data } = useSiteData();
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const projects = data?.projects || [];
  const categories = data?.categories || ["All"];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchCat = cat === "All" || (p.category || "").toLowerCase() === cat.toLowerCase();
      const matchQ = !q || `${p.title} ${p.industry} ${p.overview}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [cat, query, projects]);

  return (
    <>
      <Seo title="Portfolio" path="/portfolio" description="Explore Skyntrix's portfolio of premium websites, mobile apps, e-commerce and digital marketing projects with measurable results." />
      <PageHero title="Our Portfolio" subtitle="Real projects, real industries, real results. Explore the work behind the growth." crumb="Portfolio" />

      <section className="section-pad bg-base">
        <div className="container-x">
          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-8 max-w-lg">
            <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-5 py-3 shadow-card">
              <FaMagnifyingGlass className="text-ink/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, industries..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
              />
            </div>
          </motion.div>

          {/* Category filters */}
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  cat === c ? "bg-primary-gradient text-white shadow-soft" : "bg-white text-ink/70 hover:text-primary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-ink/50">No projects match your search. Try a different term.</p>
          ) : (
            <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
      <CtaSection title="Have a project in mind?" subtitle="Let's create something exceptional together — get a free consultation and quote." />
    </>
  );
}