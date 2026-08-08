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
import Pipeline from "./pages/Pipeline";
import AllLeadContacts from "./pages/lead-contacts/AllLeads";
import CreateLeadContact from "./pages/lead-contacts/CreateLead";
import SentHistory from "./pages/lead-contacts/SentHistory";
import LeadContactDetail from "./pages/lead-contacts/LeadContactDetail";
import Quotations from "./pages/quotations/Quotations";
import CreateQuotation from "./pages/quotations/CreateQuotation";
import QuotationDetail from "./pages/quotations/QuotationDetail";
import Invoices from "./pages/invoices/Invoices";
import CreateInvoice from "./pages/invoices/CreateInvoice";
import InvoiceDetail from "./pages/invoices/InvoiceDetail";
import Receipts from "./pages/receipts/Receipts";
import ReceiptDetail from "./pages/receipts/ReceiptDetail";
import Requirements from "./pages/requirements/Requirements";
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
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="lead-contacts" element={<AllLeadContacts />} />
              <Route path="lead-contacts/create" element={<CreateLeadContact />} />
              <Route path="lead-contacts/history" element={<SentHistory />} />
              <Route path="lead-contacts/:id" element={<LeadContactDetail />} />
              <Route path="lead-contacts/:id/edit" element={<CreateLeadContact />} />
              <Route path="quotations" element={<Quotations />} />
              <Route path="quotations/create" element={<CreateQuotation />} />
              <Route path="quotations/:id" element={<QuotationDetail />} />
              <Route path="quotations/:id/edit" element={<CreateQuotation />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/create" element={<CreateInvoice />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="invoices/:id/edit" element={<CreateInvoice />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="receipts/:id" element={<ReceiptDetail />} />
              <Route path="requirements" element={<Requirements />} />
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