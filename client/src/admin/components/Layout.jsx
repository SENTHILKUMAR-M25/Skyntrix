import { useState } from "react";
import { Outlet } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import Sidebar from "./Sidebar";
import { useAuth } from "../AuthContext";
import { Loading } from "./Ui";
import logo from "../../assets/logo.png"
export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base">
        <Loading label="Checking session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <FiX className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="font-display font-bold text-ink flex gap-3"> <img src={logo} alt="" className="h-6 w-6" /><h2>Skyntrix Admin</h2></div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-base p-2 text-ink"
            aria-label="Open menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { Sidebar, useAuth };