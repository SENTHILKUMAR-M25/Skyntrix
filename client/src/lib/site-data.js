// Fetches live data from the API and maps records to the shapes the public
// components already consume. Falls back to the authored static datasets so
// pages still render even when the API is empty/unavailable.
import { services as staticServices } from "../data/services";
import { testimonials as staticTestimonials, team as staticTeam, blogPosts as staticBlogPosts } from "../data/content";
import { projects as staticProjects, categories as staticCategories, industries as staticIndustries } from "../data/portfolio";
import { API_URL } from "../config/site";

const API = (API_URL || "/api").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

function toService(s) {
  const fallback = staticServices.find((x) => x.slug === s.slug) || {};
  return {
    slug: s.slug,
    name: s.title || s.name,
    short: s.short,
    icon: s.icon || "globe",
    priceFrom: s.priceFrom || "",
    overview: s.overview || "",
    features: s.features || [],
    technologies: s.technologies || [],
    benefits: s.benefits || [],
    workflow: s.workflow?.length ? s.workflow : fallback.workflow || [],
    faqs: s.faqs?.length ? s.faqs : fallback.faqs || [],
    heroImage: s.heroImage || "",
  };
}

function toProject(p, index) {
  return {
    id: p.slug || p._id || `project-${index}`,
    slug: p.slug,
    title: p.title,
    category: p.category || "Website",
    industry: p.industry || "",
    client: p.client || "",
    duration: p.duration || "",
    image: p.thumbnail || p.image || "",
    thumbnail: p.thumbnail || "",
    overview: p.overview || "",
    problem: p.problem || "",
    solution: p.solution || "",
    results: p.results || "",
    technologies: p.technologies || [],
    featured: !!p.featured,
    liveDemo: p.liveDemo || "",
    github: p.github || "",
    images: p.images || [],
    testimonial: p.testimonial && (p.testimonial.quote || p.testimonial.clientName || p.testimonial.author)
      ? { quote: p.testimonial.quote, author: p.testimonial.author, role: p.testimonial.role }
      : null,
  };
}

function toTestimonial(t) {
  const name = t.clientName || t.author || "";
  return {
    quote: t.review || t.quote || "",
    author: name,
    role: [t.designation, t.company].filter(Boolean).join(", "),
    avatar: name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2) : "C",
    rating: t.rating || 5,
  };
}

function toBlogPost(b) {
  return {
    id: b.slug || b._id,
    slug: b.slug,
    title: b.title,
    category: b.category || "Insights",
    excerpt: b.excerpt || "",
    content: b.content || "",
    author: b.author || "Skyntrix Team",
    date: b.publishedDate || b.createdAt,
    readTime: b.readTime || "5 min",
    thumbnail: b.thumbnail || b.featuredImage || "",
    tags: b.tags || [],
  };
}

function toTeamMember(m) {
  return {
    name: m.name || "",
    role: m.position || m.role || "",
    bio: m.bio || "",
    photo: m.photo || "",
    avatar: (m.name || "").split(" ").map((w) => w[0]).join("").slice(0, 2),
  };
}

export async function fetchAll() {
  const [servicesRes, portfolioRes, testimonialsRes, blogRes, teamRes] = await Promise.allSettled([
    get("/services"),
    get("/portfolio"),
    get("/testimonials"),
    get("/blogs"),
    get("/team"),
  ]);

  const services = servicesRes.status === "fulfilled" && servicesRes.value?.data?.length
    ? servicesRes.value.data.map(toService)
    : staticServices;

  const rawProjects = portfolioRes.status === "fulfilled" && portfolioRes.value?.data?.length
    ? portfolioRes.value.data
    : null;

  const projects = rawProjects ? rawProjects.map(toProject) : staticProjects;

  const categoryList = rawProjects
    ? ["All", ...new Set(rawProjects.map((p) => p.category).filter(Boolean))]
    : staticCategories;

  const testimonials = testimonialsRes.status === "fulfilled" && testimonialsRes.value?.data?.length
    ? testimonialsRes.value.data.map(toTestimonial) : staticTestimonials;

  const blogPosts = blogRes.status === "fulfilled" && blogRes.value?.data?.length
    ? blogRes.value.data.map(toBlogPost) : staticBlogPosts;

  const team = teamRes.status === "fulfilled" && teamRes.value?.data?.length
    ? teamRes.value.data.map(toTeamMember) : staticTeam;

  return {
    services,
    projects,
    portfolio: projects,
    categories: categoryList,
    industries: staticIndustries,
    testimonials,
    blogPosts,
    team,
  };
}