import { cn } from "../lib/utils";
import { Icon } from "./icons";

function titleCase(str) {
  return str ? str.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

function isImagePath(src) {
  return (
    /^(https?:)?\/\//.test(src) ||
    src.startsWith("/") ||
    src.startsWith("./") ||
    src.startsWith("data:") ||
    /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(src)
  );
}

const GRADIENTS = {
  medipulse: "from-emerald-400 to-teal-600",
  zeva: "from-fuchsia-500 to-purple-600",
  growthly: "from-blue-500 to-indigo-700",
  tastebuds: "from-amber-400 to-orange-600",
  fittech: "from-rose-500 to-red-700",
  estatehub: "from-cyan-400 to-blue-600",
  brightschool: "from-violet-400 to-purple-700",
  scrollmedia: "from-pink-500 to-rose-600"
};

export default function ProjectVisual({ image, label, className }) {
  if (image && isImagePath(image)) {
    return (
      <div className={cn("relative overflow-hidden bg-gradient-to-br from-primary to-secondary", className)}>
        <img src={image} alt={label} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", GRADIENTS[image] || "from-primary to-secondary", className)}>
      <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-xl" />
      <div className="absolute inset-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
          <Icon name="globe" className="h-9 w-9" />
        </div>
      </div>
      <div className="absolute bottom-3 left-4 rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        {titleCase(label)}
      </div>
    </div>
  );
}
