import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { usePhishingStore, useUIStore } from './store';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Reveal from './pages/Reveal';
import Entry from './pages/Entry';
import Dashboard from './pages/Dashboard';
import AdminNotifications from './pages/AdminNotifications';
import InboxDetail from './pages/InboxDetail';
import AdminLoans from './pages/AdminLoans';
import AdminKYC from './pages/AdminKYC';
import Task from './pages/Task';
import Learn from './pages/Learn';
import FAQ from './pages/FAQ';
import Support from './pages/Support';
import './index.css';

// ─── Page title map ───
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/admin/notifications': 'Notification Center',
  '/admin/loans': 'Loan Management',
  '/admin/kyc': 'KYC Verification',
  '/task': 'HR Declaration',
  '/learn': 'Learning Hub',
  '/faq': 'FAQ',
  '/support': 'Support',
  '/admin/users': 'Users',
  '/admin/fraud': 'Fraud Alerts',
};

// ─── Protected layout (same as main app) ───
const AppLayout: React.FC = () => {
  const { jwt, revealTriggered } = usePhishingStore();
  const { sidebarOpen } = useUIStore();
  const location = useLocation();

  const title =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/inbox/') ? 'Email Detail' : 'Employee Portal');

  if (!jwt) return <Navigate to="/" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <Header title={title} />
      <main className={`main-content${sidebarOpen ? '' : ' collapsed'}`}>
        <Outlet />
      </main>
      {revealTriggered && <Reveal />}
    </div>
  );
};

// ─── Placeholder for routes shown in header tabs but not yet needed ───
const PlaceholderPage: React.FC<{ name: string }> = ({ name }) => (
  <div>
    <div className="page-header">
      <div><h2>{name}</h2><p>This section is available in the full employee portal</p></div>
    </div>
    <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      Navigate to Notifications to see your inbox and pending actions.
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' },
        }}
      />
      <Routes>
        {/* Auto-auth entry points */}
        <Route path="/" element={<Entry />} />
        <Route path="/phishing" element={<Entry />} />

        {/* Authenticated portal */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Notifications tab — contains the phishing inbox as "Messages" */}
          <Route path="/admin/notifications" element={<AdminNotifications />} />

          {/* Inbox detail — accessible when user clicks an email in Notifications */}
          <Route path="/inbox/:id" element={<InboxDetail />} />

          {/* Employee operations */}
          <Route path="/admin/loans" element={<AdminLoans />} />
          <Route path="/admin/kyc" element={<AdminKYC />} />
          <Route path="/admin/kyc/escalated" element={<AdminKYC />} />

          {/* Phishing task form */}
          <Route path="/task" element={<Task />} />

          {/* Help section */}
          <Route path="/learn" element={<Learn />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/support" element={<Support />} />

          {/* Header tab routes — shown in nav but minimal content */}
          <Route path="/admin/users" element={<PlaceholderPage name="User Management" />} />
          <Route path="/admin/fraud" element={<PlaceholderPage name="Fraud Alerts" />} />

          {/* User dropdown routes */}
          <Route path="/settings" element={<PlaceholderPage name="Settings" />} />
          <Route path="/settings/profile" element={<PlaceholderPage name="My Profile" />} />
          <Route path="/sessions" element={<PlaceholderPage name="Security & Sessions" />} />
          <Route path="/data-privacy" element={<PlaceholderPage name="Data Privacy" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
