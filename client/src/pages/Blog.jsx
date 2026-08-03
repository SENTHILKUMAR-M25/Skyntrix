import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaMagnifyingGlass, FaArrowRight, FaClock } from "react-icons/fa6";
import Seo from "../components/Seo";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import CtaSection from "../components/CtaSection";
import { useSiteData } from "../lib/SiteDataContext";

export default function Blog() {
  const { data } = useSiteData();
  const blogPosts = data?.blogPosts || [];
  const blogCategories = ["All", ...new Set(blogPosts.map((b) => b.category).filter(Boolean))];
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return blogPosts.filter((b) => {
      const matchCat = cat === "All" || b.category === cat;
      const q = query.trim().toLowerCase();
      const matchQ = !q || `${b.title} ${b.excerpt} ${b.tags.join(" ")}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [cat, query]);

  return (
    <>
      <Seo title="Blog" path="/blog" description="Insights, guides and trends from Skyntrix on SEO, design, development and digital growth." />
      <PageHero title="Insights & Ideas" subtitle="Actionable guides on design, development, SEO and growth — from the team that builds and grows brands." crumb="Blog" />

      <section className="section-pad bg-base">
        <div className="container-x">
          <div className="mx-auto mb-8 max-w-lg">
            <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-5 py-3 shadow-card">
              <FaMagnifyingGlass className="text-ink/40" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles..." className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40" />
            </div>
          </div>
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            {blogCategories.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${cat === c ? "bg-primary-gradient text-white shadow-soft" : "bg-white text-ink/70 hover:text-primary"}`}>
                {c}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-ink/50">No articles match your search.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {filtered.map((b, i) => (
                <Reveal key={b.id} delay={i * 0.05}>
                  <Link to={`/blog/${b.slug}`} className="card group block h-full overflow-hidden hover:-translate-y-1 hover:shadow-soft">
                    <div className="h-44 overflow-hidden bg-gradient-to-br from-primary to-secondary">
                      <div className="flex items-center justify-between p-4">
                        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{b.category}</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-ink/50">
                        <span>{b.author}</span><span>•</span><span className="flex items-center gap-1.5"><FaClock className="h-3 w-3" />{b.readTime}</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold text-ink transition-colors group-hover:text-primary">{b.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-ink/55">{b.excerpt}</p>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Read Article <FaArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
      <CtaSection title="Want a custom growth strategy?" subtitle="Get tailored insights for your business — book a free consultation today." />
    </>
  );
}