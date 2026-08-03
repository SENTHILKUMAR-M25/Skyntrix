import Seo from "../components/Seo";
import Hero from "../sections/Hero";
import AboutIntro from "../sections/AboutIntro";
import ServicesOverview from "../sections/ServicesOverview";
import Stats from "../sections/Stats";
import WhyChooseUs from "../sections/WhyChooseUs";
import FeaturedProjects from "../sections/FeaturedProjects";
import ProcessTimeline from "../sections/ProcessTimeline";
import TechStack from "../sections/TechStack";
import Industries from "../sections/Industries";
import Testimonials from "../sections/Testimonials";
import BlogPreview from "../sections/BlogPreview";
import HomeFAQ from "../sections/HomeFAQ";
import CtaSection from "../components/CtaSection";

export default function Home() {
  return (
    <>
      <Seo description="Skyntrix Technologies builds premium websites, mobile apps, branding and SEO that drive real growth. Get a free consultation today." />
      <Hero />
      <AboutIntro />
      <ServicesOverview />
      <Stats />
      <WhyChooseUs />
      <FeaturedProjects />
      <ProcessTimeline />
      <TechStack />
      <Industries />
      <Testimonials />
      <BlogPreview />
      <HomeFAQ />
      <CtaSection />
    </>
  );
}