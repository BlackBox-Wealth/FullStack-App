import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUIStore } from './store/useUIStore'
import { useEffect } from 'react'

// Admin pages
import AdminOverview from './pages/admin/Overview'
import AdminEmployees from './pages/admin/Employees'
import AdminSimulations from './pages/admin/Simulations'
import AdminThreats from './pages/admin/ThreatIntelligence'
import AdminReports from './pages/admin/Reports'

// Portal pages (employee simulation — accessible to admin for review/testing)
import PortalDashboard from './pages/portal/Dashboard'
import Inbox from './pages/portal/Inbox'
import InboxDetail from './pages/portal/InboxDetail'
import Memos from './pages/portal/Memos'
import ITSupport from './pages/portal/ITSupport'
import Accounts from './pages/portal/Accounts'
import Approvals from './pages/portal/Approvals'
import PortalSettings from './pages/portal/PortalSettings'
import ScenarioPage from './pages/portal/ScenarioPage'
import IncidentForm from './pages/portal/IncidentForm'

// Sentinel landing pages (no auth — accessed from email links)
import PhishingHarvestPage from './pages/sentinel/PhishingHarvestPage'
import SocialEngPage from './pages/sentinel/SocialEngPage'
import IncidentDrillPage from './pages/sentinel/IncidentDrillPage'

// Layouts
import PortalLayout from './components/layout/PortalLayout'
import AdminLayout from './components/layout/AdminLayout'
import AuthGate from './components/AuthGate'

export default function App() {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        {/* Sentinel landing pages — unauthenticated (email link targets) */}
        <Route path="/sentinel/landing/harvest/:type" element={<PhishingHarvestPage />} />
        <Route path="/sentinel/landing/social/:token" element={<SocialEngPage />} />
        <Route path="/sentinel/landing/incident/:token" element={<IncidentDrillPage />} />

        {/* All other routes require a valid admin session via httpOnly cookie */}
        <Route element={<AuthGate />}>
          <Route path="/" element={<Navigate to="/admin/overview" replace />} />

          {/* Admin Control Panel */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="simulations" element={<AdminSimulations />} />
            <Route path="threats" element={<AdminThreats />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          {/* Employee Portal simulation — admin can preview employee experience */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PortalDashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="inbox/:emailId" element={<InboxDetail />} />
            <Route path="memos" element={<Memos />} />
            <Route path="it-support" element={<ITSupport />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="settings" element={<PortalSettings />} />
            <Route path="scenario/:token" element={<ScenarioPage />} />
            <Route path="incident/:token" element={<IncidentForm />} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
