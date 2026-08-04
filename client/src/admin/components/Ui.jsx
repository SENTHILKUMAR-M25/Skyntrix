import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export function Spinner({ className }) {
  return (
    <svg className={cn("animate-spin", className || "h-5 w-5")} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Loading({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-ink/50">
      <Spinner className="h-6 w-6 text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", hint }) {
  return (
    <div className="py-16 text-center text-ink/50">
      <div className="text-4xl mb-3">🗂️</div>
      <div className="font-semibold text-ink/70">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}

const STATUS_COLORS = {
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
  scheduled: "bg-secondary-100 text-secondary-700 border-secondary-600",
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-indigo-100 text-indigo-700 border-indigo-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
  reviewed: "bg-teal-100 text-teal-700 border-teal-200",
  interviewed: "bg-purple-100 text-purple-700 border-purple-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  hired: "bg-emerald-100 text-emerald-700 border-emerald-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({ value }) {
  const key = String(value || "draft").toLowerCase();
  const cls = STATUS_COLORS[key] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize", cls)}>
      {String(value || "—")}
    </span>
  );
}

export function Button({ variant = "primary", size = "md", className, loading, children, ...props }) {
  const styles = {
    primary: "bg-primary-gradient text-white hover:shadow-soft",
    secondary: "bg-white text-primary border border-primary/20 hover:border-primary/50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent text-ink border border-ink/15 hover:border-ink/40",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed",
        styles[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, required, error, hint, children }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium text-ink/70 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink/40">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-base bg-white px-3 py-2 text-sm text-ink placeholder:ink/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition";

export const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} {...props} className={cn(inputBase, props.className)} />;
});

export const Textarea = forwardRef(function Textarea(props, ref) {
  return <textarea ref={ref} rows={props.rows || 4} {...props} className={cn(inputBase, props.className)} />;
});

export const Select = forwardRef(function Select({ options = [], placeholder, ...props }, ref) {
  return (
    <select ref={ref} {...props} className={cn(inputBase, "appearance-none", props.className)}>
      {placeholder !== false && <option value="">{placeholder || "Select..."}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center text-sm gap-2 focus:outline-none"
    >
      <span
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </span>
      {label && <span className="text-ink/70">{label}</span>}
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm">
      <div className={cn("mt-10 w-full rounded-2xl bg-white shadow-2xl", widths[size])}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="heading-md text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}