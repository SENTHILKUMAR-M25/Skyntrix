import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa6";
import ProjectVisual from "./ProjectVisual";

export default function ProjectCard({ project, index = 0 }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Link
        to={`/portfolio/${project.slug}`}
        className="card group block overflow-hidden hover:-translate-y-1.5 hover:shadow-soft"
      >
        <div className="overflow-hidden"><ProjectVisual image={project.image} label={project.title} className="h-52" /></div>
        <div className="p-6">
          <div className="flex items-center justify-between text-xs">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{project.category}</span>
            <span className="text-ink/50">{project.industry}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-ink transition-colors group-hover:text-primary">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-ink/55">{project.overview}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            View case study <FaArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}