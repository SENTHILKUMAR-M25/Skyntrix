import { Link } from "react-router-dom";
import { FaArrowRight, FaClock } from "react-icons/fa6";
import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import { useSiteData } from "../lib/SiteDataContext";

export default function BlogPreview() {
  const { data } = useSiteData();
  const latest = (data?.blogPosts || []).slice(0, 3);
  return (
    <section className="section-pad bg-base">
      <div className="container-x">
        <SectionHeading
          label="Insights"
          title="Fresh Thinking From Our Team"
          subtitle="Practical guides on SEO, design, development and growth — written by the people who build for you."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((b, i) => (
            <Reveal key={b.id} delay={i * 0.07}>
              <Link to={`/blog/${b.slug}`} className="card group block h-full overflow-hidden hover:-translate-y-1 hover:shadow-soft">
                <div className="h-44 overflow-hidden bg-gradient-to-br from-primary to-secondary">
                  <span className="m-4 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">{b.category}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-ink/50">
                    <span>{b.author}</span><span>•</span>
                    <span className="flex items-center gap-1"><FaClock className="h-3 w-3" />{b.readTime}</span>
                  </div>
                  <h3 className="heading-md mt-3 text-[1.2rem] text-ink group-hover:text-primary transition-colors">{b.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink/55">{b.excerpt}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12 text-center">
          <Link to="/blog" className="btn-secondary">Read the Blog <FaArrowRight /></Link>
        </Reveal>
      </div>
    </section>
  );
}