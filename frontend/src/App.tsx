import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useUIStore } from './store';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Payments from './pages/Payments';
import Investments from './pages/Investments';
import Goals from './pages/Goals';
import SIPs from './pages/SIPs';
import Loans from './pages/Loans';
import Recommendations from './pages/Recommendations';
import AdminUsers from './pages/AdminUsers';
import AdminKYC from './pages/AdminKYC';
import AdminLoans from './pages/AdminLoans';
import AdminFraud from './pages/AdminFraud';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminAudit from './pages/AdminAudit';
import WhatIf from './pages/WhatIf';
import SecurityAlert from './pages/SecurityAlert';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

// Protected route wrapper
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
};

// App layout with sidebar and header
const AppLayout: React.FC = () => {
  const { sidebarOpen } = useUIStore();

  const getPageTitle = () => {
    const path = window.location.pathname;
    const titles: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/accounts': 'Accounts',
      '/transactions': 'Transactions',
      '/payments': 'Payments',
      '/investments': 'Investments',
      '/goals': 'Financial Goals',
      '/sips': 'Wealth SIPs',
      '/loans': 'Loans',
      '/recommendations': 'AI Recommendations',
      '/admin/users': 'User Management',
      '/admin/kyc': 'KYC Verification',
      '/admin/loans': 'Loan Management',
      '/admin/fraud': 'Fraud Alerts',
      '/admin/analytics': 'Analytics',
      '/admin/audit': 'Audit Logs',
      '/ai/scenarios': 'AI Wealth Simulator',
    };
    return titles[path] || 'WealthVault';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Header title={getPageTitle()} />
      <main className={`main-content ${!sidebarOpen ? 'collapsed' : ''}`}>
        <Outlet />
      </main>
      <Chatbot />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/security/alert" element={<SecurityAlert />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/sips" element={<SIPs />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/ai/scenarios" element={<WhatIf />} />

            {/* Admin Routes */}
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/kyc" element={<AdminKYC />} />
            <Route path="/admin/loans" element={<AdminLoans />} />
            <Route path="/admin/fraud" element={<AdminFraud />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
