import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const toast = useCallback({
    ok: (m) => push("ok", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }, [push]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-card border text-sm font-medium text-white flex items-start gap-2 ${
              t.type === "error" ? "bg-red-600 border-red-500" : t.type === "info" ? "bg-secondary border-secondary/60" : "bg-emerald-600 border-emerald-500"
            }`}
          >
            <span>{t.type === "error" ? "✕" : t.type === "info" ? "ⓘ" : "✓"}</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};