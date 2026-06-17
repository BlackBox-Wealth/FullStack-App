import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useUIStore } from './store';
import { useScreenReader } from './hooks/useScreenReader';
import useVoiceNavigation from './hooks/useVoiceNavigation';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import Login from './pages/Login';
import Register from './pages/Register';
import NavigationTour from './components/NavigationTour';
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
import AdminKYCReview from './pages/AdminKYCReview';
import KYCSubmission from './pages/KYCSubmission';
import AdminLoans from './pages/AdminLoans';
import AdminFraud from './pages/AdminFraud';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminAudit from './pages/AdminAudit';
import AdminPerformance from './pages/AdminPerformance';
import AdminNotifications from './pages/AdminNotifications';
import AdminRisk from './pages/AdminRisk';
import WhatIf from './pages/WhatIf';
import SecurityAlert from './pages/SecurityAlert';
import Settings from './pages/Settings';
import FAQ from './pages/FAQ';
import Support from './pages/Support';
import ForgotPassword from './pages/ForgotPassword';
import Sessions from './pages/Sessions';
import AccountAggregator from './pages/AccountAggregator';
import AssetVault from './pages/AssetVault';
import Budgets from './pages/Budgets';
import Family from './pages/Family';
import DataPrivacy from './pages/DataPrivacy';
import CreditScore from './pages/CreditScore';
import TaxHelper from './pages/TaxHelper';
import AIAgents from './pages/AIAgents';
import Learn from './pages/Learn';
import PhishingLanding from './pages/PhishingLanding';
import { Toaster } from 'react-hot-toast';
import PreferenceApplier from './components/layout/PreferenceApplier';
import AppFooter from './components/layout/AppFooter';
import Footer from './components/Footer';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import PageLoader from './components/animation/PageLoader';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

// Protected route wrapper
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isRehydrating } = useAuthStore();

  if (isRehydrating) {
    return <PageLoader label="Checking session" />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
};

// App layout with sidebar and header
const AppLayout: React.FC = () => {
  const { user } = useAuthStore();
  const { sidebarOpen, accessibility } = useUIStore();

  // Initialize voice navigation if enabled
  useVoiceNavigation(accessibility.voiceNavigation);

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
      '/faq': 'FAQ',
      '/support': 'Support',
      '/admin/users': 'User Management',
      '/admin/notifications': 'Notification Center',
      '/admin/risk': 'Risk Dashboard',
      '/admin/kyc': 'KYC Verification',
      '/admin/loans': 'Loan Management',
      '/admin/fraud': 'Fraud Alerts',
      '/admin/analytics': 'Analytics',
      '/admin/audit': 'Audit Logs',
      '/admin/performance': 'System Performance',
      '/ai/scenarios': 'AI Wealth Simulator',
      '/settings': 'Settings',
      '/sessions': 'Active Sessions',
      '/account-aggregator': 'Account Aggregator',
      '/asset-vault': 'Asset Vault',
      '/family': 'Family',
      '/data-privacy': 'Data Privacy',
      '/credit-score': 'Credit Score',
      '/tax': 'Tax Helper',
      '/learn': 'Financial Learning Hub',
    };
    return titles[path] || 'WealthVault';
  };

  return (
    <div className="app-layout">
      <PreferenceApplier />
      <Sidebar />
      <Header title={getPageTitle()} />
      <main className={`main-content ${!sidebarOpen ? 'collapsed' : ''}`}>
        <Outlet />
        <AppFooter />
      </main>
      <Chatbot />
      <NavigationTour />
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  useScreenReader();
  const { login, logout } = useAuthStore();
  const { initializeFromUser } = useUIStore();

  useEffect(() => {
    const rehydrate = async () => {
      try {
        // Use skipAuthRefresh so a 401 here silently means "not logged in" — no redirect loop
        const { authAPI } = await import('./api');
        const res = await authAPI.me({ skipAuthRefresh: true } as any);
        login(res.data);
        initializeFromUser(res.data);
      } catch {
        // 401 = no active session — clear any stale persisted auth so ProtectedRoute redirects to login
        logout();
      }
    };
    rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' } }} />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<><Login /><Footer /></>} />
          <Route path="/register" element={<><Register /><Footer /></>} />
          <Route path="/forgot-password" element={<><ForgotPassword /><Footer /></>} />
          <Route path="/security/alert" element={<><SecurityAlert /><Footer /></>} />
          <Route path="/phishing-landing" element={<PhishingLanding />} />

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
            <Route path="/faq" element={<FAQ />} />
            <Route path="/support" element={<Support />} />
            <Route path="/ai/scenarios" element={<WhatIf />} />
            <Route path="/ai/agents" element={<AIAgents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/account-aggregator" element={<AccountAggregator />} />
            <Route path="/asset-vault" element={<AssetVault />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/family" element={<Family />} />
            <Route path="/data-privacy" element={<DataPrivacy />} />
            <Route path="/credit-score" element={<CreditScore />} />
            <Route path="/tax" element={<TaxHelper />} />
            <Route path="/learn" element={<Learn />} />

            {/* Admin Routes - Role Protected */}
            <Route element={<RoleProtectedRoute allowedRoles={['employee', 'relationship_manager', 'super_admin']} />}>
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/kyc" element={<AdminKYCReview />} />
              <Route path="/admin/kyc/escalated" element={<AdminKYCReview />} />
              <Route path="/admin/loans" element={<AdminLoans />} />
              <Route path="/admin/fraud" element={<AdminFraud />} />
            </Route>

            {/* Manager+ Only Routes */}
            <Route element={<RoleProtectedRoute allowedRoles={['relationship_manager', 'super_admin']} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/risk" element={<AdminRisk />} />
            </Route>

            {/* Super Admin Only Routes */}
            <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route path="/admin/performance" element={<AdminPerformance />} />
            </Route>

            {/* KYC Submission - All authenticated users */}
            <Route path="/kyc" element={<KYCSubmission />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
