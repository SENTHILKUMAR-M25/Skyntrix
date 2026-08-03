import { useCallback } from "react";

export function useScrollReveal(threshold = 0.15) {
  // Lightweight delegated observer hook
  const observe = useCallback((containerRef) => {
    const els = containerRef.current?.querySelectorAll("[data-reveal]");
    if (!els?.length) return () => {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [threshold]);

  return { observe };
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const cn = (...classes) => classes.filter(Boolean).join(" ");

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}