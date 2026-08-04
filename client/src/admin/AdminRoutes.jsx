import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";
import Protected from "./components/Protected";
import AdminLayout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Portfolio from "./pages/Portfolio";
import Team from "./pages/Team";
import Testimonials from "./pages/Testimonials";
import Blog from "./pages/Blog";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import AllLeadContacts from "./pages/lead-contacts/AllLeads";
import CreateLeadContact from "./pages/lead-contacts/CreateLead";
import SentHistory from "./pages/lead-contacts/SentHistory";
import LeadContactDetail from "./pages/lead-contacts/LeadContactDetail";
import Careers from "./pages/Careers";
import Newsletter from "./pages/Newsletter";
import Settings from "./pages/Settings";
import Admins from "./pages/Admins";

export default function AdminRoutes() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<Protected />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="services" element={<Services />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="team" element={<Team />} />
              <Route path="testimonials" element={<Testimonials />} />
              <Route path="blog" element={<Blog />} />
              <Route path="leads" element={<Leads />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="lead-contacts" element={<AllLeadContacts />} />
              <Route path="lead-contacts/create" element={<CreateLeadContact />} />
              <Route path="lead-contacts/history" element={<SentHistory />} />
              <Route path="lead-contacts/:id" element={<LeadContactDetail />} />
              <Route path="lead-contacts/:id/edit" element={<CreateLeadContact />} />
              <Route path="careers" element={<Careers />} />
              <Route path="newsletter" element={<Newsletter />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admins" element={<Admins />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}