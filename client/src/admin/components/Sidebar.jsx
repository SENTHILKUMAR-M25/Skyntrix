import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { FaTachometerAlt, FaCogs, FaImages, FaUsers, FaComments, FaNewspaper, FaBriefcase, FaEnvelope, FaPaperPlane, FaCog, FaShieldAlt, FaSignOutAlt, FaAddressBook, FaChevronDown, FaListAlt, FaPlusCircle, FaHistory, FaColumns } from "react-icons/fa";
import { FaFileInvoiceDollar, FaFileCirclePlus, FaFileLines } from "react-icons/fa6";
import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import { cn } from "../../lib/utils";
import logo from "../../assets/logo.png"
const links = [
  { to: "/admin/dashboard", label: "Dashboard", icon: FaTachometerAlt },
  { to: "/admin/services", label: "Services", icon: FaCogs },
  { to: "/admin/portfolio", label: "Portfolio", icon: FaImages },
  { to: "/admin/team", label: "Team", icon: FaUsers },
  { to: "/admin/testimonials", label: "Testimonials", icon: FaComments },
  { to: "/admin/blog", label: "Blog Posts", icon: FaNewspaper },
  { to: "/admin/leads", label: "Leads", icon: FaEnvelope },
  { to: "/admin/pipeline", label: "Pipeline", icon: FaColumns },
  { to: "/admin/careers", label: "Applications", icon: FaBriefcase },
  { to: "/admin/newsletter", label: "Newsletter", icon: FaPaperPlane },
  { to: "/admin/settings", label: "Settings", icon: FaCog },
  { to: "/admin/admins", label: "Admins", icon: FaShieldAlt },
];

const leadContactLinks = [
  { to: "/admin/lead-contacts", label: "All Leads", icon: FaListAlt },
  { to: "/admin/lead-contacts/create", label: "Create Lead", icon: FaPlusCircle },
  { to: "/admin/lead-contacts/history", label: "Sent History", icon: FaHistory },
];

const quotationLinks = [
  { to: "/admin/quotations", label: "All Quotations", icon: FaFileLines },
  { to: "/admin/quotations/create", label: "Create Quotation", icon: FaFileCirclePlus },
];

const invoiceLinks = [
  { to: "/admin/invoices", label: "All Invoices", icon: FaFileLines },
  { to: "/admin/invoices/create", label: "Create Invoice", icon: FaFileCirclePlus },
];

export default function Sidebar({ onNavigate }) {
  const { admin, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [leadContactOpen, setLeadContactOpen] = useState(location.pathname.startsWith("/admin/lead-contacts"));
  const [quotationOpen, setQuotationOpen] = useState(location.pathname.startsWith("/admin/quotations"));
  const [invoiceOpen, setInvoiceOpen] = useState(location.pathname.startsWith("/admin/invoices"));

  const handleLogout = async () => {
    await logout();
    toast.info("Signed out");
    navigate("/admin/login");
  };

  return (
    <aside className="flex h-full flex-col bg-ink text-white">
      <div className="flex items-center gap-4 px-5 py-5">
        <img src={logo}  alt="" className="h-10 w-10" />
        <div>
          <div className="font-display font-bold leading-none">Skyntrix</div>
          <div className="text-[11px] text-white/50 uppercase tracking-wider">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )
            }
          >
            <l.icon className="h-4 w-4 shrink-0" />
            {l.label}
          </NavLink>
        ))}

        {/* Lead Contact group */}
        <div className="mt-2">
          <button
            onClick={() => setLeadContactOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname.startsWith("/admin/lead-contacts") ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <FaAddressBook className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Lead Contact</span>
            <FaChevronDown className={cn("h-3 w-3 transition-transform", leadContactOpen && "rotate-180")} />
          </button>
          {leadContactOpen && (
            <div className="mt-1 space-y-0.5 border-l border-white/10 pl-3 ml-4">
              {leadContactLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive ? "bg-primary-gradient text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <l.icon className="h-3.5 w-3.5 shrink-0" />
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Quotations group */}
        <div className="mt-2">
          <button
            onClick={() => setQuotationOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname.startsWith("/admin/quotations") ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <FaFileInvoiceDollar className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Quotations</span>
            <FaChevronDown className={cn("h-3 w-3 transition-transform", quotationOpen && "rotate-180")} />
          </button>
          {quotationOpen && (
            <div className="mt-1 space-y-0.5 border-l border-white/10 pl-3 ml-4">
              {quotationLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive ? "bg-primary-gradient text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <l.icon className="h-3.5 w-3.5 shrink-0" />
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Invoices group */}
        <div className="mt-2">
          <button
            onClick={() => setInvoiceOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname.startsWith("/admin/invoices") ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <FaFileInvoiceDollar className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Invoices</span>
            <FaChevronDown className={cn("h-3 w-3 transition-transform", invoiceOpen && "rotate-180")} />
          </button>
          {invoiceOpen && (
            <div className="mt-1 space-y-0.5 border-l border-white/10 pl-3 ml-4">
              {invoiceLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive ? "bg-primary-gradient text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <l.icon className="h-3.5 w-3.5 shrink-0" />
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-gradient font-bold text-sm uppercase">
            {(admin?.name || "A")[0]}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{admin?.name}</div>
            <div className="truncate text-xs text-white/40">{admin?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <FaSignOutAlt className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}