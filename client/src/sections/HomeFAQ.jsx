import Reveal from "../components/Reveal";
import SectionHeading from "../components/SectionHeading";
import FAQ from "../components/FAQ";
import { faqsGeneral } from "../data/content";

export default function HomeFAQ() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <SectionHeading
          label="FAQ"
          title="Questions? We've Got Answers"
          subtitle="Everything you need to know before starting your project with Skyntrix."
        />
        <FAQ items={faqsGeneral} />
      </div>
    </section>
  );
}