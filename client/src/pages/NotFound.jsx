import { Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";
import Seo from "../components/Seo";
import CtaSection from "../components/CtaSection";

export default function NotFound({ title = "Page Not Found" }) {
  return (
    <>
      <Seo title={title} description="The page you're looking for could not be found." />
      <section className="section-pad bg-base">
        <div className="container-x">
          <div className="mx-auto max-w-xl py-16 text-center">
            <p className="font-display text-7xl font-bold text-primary-gradient sm:text-8xl">404</p>
            <h1 className="mt-4 font-display text-3xl font-bold text-ink">{title}</h1>
            <p className="mt-4 text-ink/60">
              {title === "Page Not Found"
                ? "The page you're looking for doesn't exist, may have been moved, or is no longer available."
                : "This page outlines important information. If you'd like to learn more, please contact our team."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/" className="btn-primary"><FaArrowLeft className="h-4 w-4" /> Back to Home</Link>
              <Link to="/contact" className="btn-secondary">Contact Us</Link>
            </div>
          </div>
        </div>
      </section>
      <CtaSection title="Have a project in mind?" subtitle="Let's build something great together — book a free consultation today." />
    </>
  );
}