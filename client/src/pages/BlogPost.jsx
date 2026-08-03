import { useParams, Link } from "react-router-dom";
import { FaChevronLeft, FaClock, FaXTwitter, FaLinkedinIn, FaFacebookF, FaCalendar } from "react-icons/fa6";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import CtaSection from "../components/CtaSection";
import { SITE } from "../config/site";
import { useSiteData } from "../lib/SiteDataContext";

export default function BlogPost() {
  const { slug } = useParams();
  const { data } = useSiteData();
  const blogPosts = data?.blogPosts || [];
  const post = blogPosts.find((b) => b.slug === slug) || blogPosts[0];
  const related = blogPosts.filter((b) => b.category === post.category && b.id !== post.id).slice(0, 3);
  const shareUrl = `${SITE.url}/blog/${post.slug}`;

  const paragraphs = [
    post.excerpt,
    "In today's increasingly competitive digital landscape, standing still is the same as moving backwards. Businesses that prioritise a premium digital presence consistently outperform their peers — not just in traffic, but in trust, authority and revenue.",
    "The fundamentals matter more than ever. A fast, accessible, beautifully-designed experience isn't a luxury; it's the baseline customers now expect. Combined with a clear strategy and measurable optimisation, these fundamentals compound into significant, lasting growth over time.",
    "At Skyntrix, we've helped hundreds of brands turn their digital presence into a growth engine. The winning businesses share one trait: they treat their website and digital channels as strategic assets, continuously refined with data and customer insight.",
    "Whether you're just starting out or ready to scale, the principles are the same — clarity of message, quality of experience, and consistent iteration. Start with the user. Measure everything. Improve relentlessly."
  ];

  return (
    <>
      <Seo title={post.title} path={`/blog/${post.slug}`} description={post.excerpt} type="article" />
      <article className="pt-32 pb-20 md:pt-40">
        <div className="container-x">
          <Reveal className="mx-auto max-w-3xl">
            <Link to="/blog" className="mb-6 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-primary"><FaChevronLeft className="h-3 w-3" /> Back to Blog</Link>
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{post.category}</span>
            <h1 className="heading-xl mt-4 text-ink">{post.title}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink/50">
              <span className="flex items-center gap-1.5"><FaXTwitter className="h-3.5 w-3.5" />{post.author}</span>
              <span className="flex items-center gap-1.5"><FaCalendar className="h-3.5 w-3.5" />{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              <span className="flex items-center gap-1.5"><FaClock className="h-3.5 w-3.5" />{post.readTime} read</span>
            </div>
          </Reveal>

          <Reveal className="mx-auto mt-8 max-w-3xl">
            <div className="h-64 rounded-3xl bg-gradient-to-br from-primary to-secondary md:h-96" />
          </Reveal>

          <div className="mx-auto mt-10 max-w-3xl">
            {paragraphs.map((p, i) => (
              <Reveal key={i} className="mb-6">
                <p className={`leading-relaxed ${i === 0 ? "text-lg text-ink/80" : "text-ink/65"}`}>{p}</p>
              </Reveal>
            ))}

            <Reveal className="my-10 rounded-2xl bg-primary/5 p-6 border border-primary/10">
              <h2 className="heading-md text-ink">Key Takeaway</h2>
              <p className="mt-2 text-ink/70">Premium digital experiences aren't optional — they're the most reliable competitive advantage available to modern businesses. Invest in quality, measure relentlessly, and grow consistently.</p>
            </Reveal>

            <Reveal className="mt-10 flex items-center justify-between border-t border-ink/10 pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-gradient font-bold text-white">{post.author.split(" ").map((w) => w[0]).join("")}</span>
                <div>
                  <div className="font-semibold text-ink">{post.author}</div>
                  <div className="text-xs text-ink/50">Contributor, Skyntrix</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink/50">Share</span>
                <a href={`https://twitter.com/intent/tweet?url=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="Share on Twitter" className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-primary hover:text-white"><FaXtwitter className="h-3.5 w-3.5" /></a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="Share on LinkedIn" className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-primary hover:text-white"><FaLinkedinIn className="h-3.5 w-3.5" /></a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="Share on Facebook" className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-primary hover:text-white"><FaFacebookF className="h-3.5 w-3.5" /></a>
              </div>
            </Reveal>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="section-pad pt-0">
          <div className="container-x">
            <h2 className="heading-lg mb-8">Related Articles</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {related.map((b) => (
                <Link key={b.id} to={`/blog/${b.slug}`} className="card group block p-6 hover:-translate-y-1 hover:shadow-soft">
                  <div className="text-xs font-semibold text-primary">{b.category}</div>
                  <h3 className="mt-2 font-display text-lg font-bold text-ink transition-colors group-hover:text-primary">{b.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink/55">{b.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaSection />
    </>
  );
}