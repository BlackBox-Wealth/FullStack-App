import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useUIStore } from '../../store/useUIStore'
import client from '../../api/client'
import {
  LayoutDashboard, Inbox, FileText, Headphones, CreditCard,
  CheckSquare, BarChart2, Settings, ChevronLeft, ChevronRight,
  Bell, LogOut, Sun, Moon
} from 'lucide-react'

const NAV = [
  { to: 'dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { to: 'accounts',   label: 'My Accounts',      icon: CreditCard },
  { to: 'approvals',  label: 'Approvals',        icon: CheckSquare },
  { to: 'inbox',      label: 'Internal Mail',    icon: Inbox },
  { to: 'memos',      label: 'Internal Memos',   icon: FileText },
  { to: 'it-support', label: 'IT Support',       icon: Headphones },
  { to: 'reports',    label: 'Reports',          icon: BarChart2, disabled: true },
  { to: 'settings',   label: 'Settings',         icon: Settings },
]

const THEMES = ['midnight', 'linen', 'sepia', 'aurora', 'graphite'] as const

export default function PortalLayout() {
  const { user, clearAuth } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useUIStore()
  const [showTheme, setShowTheme] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await client.post('/auth/logout') } finally { clearAuth() }
  }

  return (
    <div className="flex h-screen bg-bg-base text-text-primary overflow-hidden bg-composite">
      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 bg-bg-card border-r border-border transition-all duration-300 ${
          sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-header border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center shrink-0">
            <span className="text-accent-primary font-heading font-bold text-sm">PSB</span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <div className="font-heading font-semibold text-sm text-text-primary leading-tight">WealthVault</div>
              <div className="text-xs text-text-muted">Internal Portal</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV.map(({ to, label, icon: Icon, disabled }) => (
            disabled ? (
              <div
                key={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-text-muted cursor-not-allowed opacity-50 ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon size={18} className="shrink-0" />
                {!sidebarCollapsed && <span className="text-sm">{label}</span>}
              </div>
            ) : (
              <NavLink
                key={to}
                to={`/portal/${to}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-sm transition-fast ${
                    sidebarCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-accent-primary/10 text-accent-primary font-medium'
                      : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'
                  }`
                }
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!sidebarCollapsed && <span className="text-sm">{label}</span>}
              </NavLink>
            )
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-primary transition-fast"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-header bg-bg-card border-b border-border shrink-0">
          <div>
            <h1 className="font-heading font-semibold text-base text-text-primary">Punjab &amp; Sind Bank</h1>
            <p className="text-xs text-text-muted">Employee Internal Portal</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme switcher */}
            <div className="relative">
              <button
                onClick={() => setShowTheme(!showTheme)}
                className="w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-fast"
              >
                {theme === 'midnight' || theme === 'graphite' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              {showTheme && (
                <div className="absolute right-0 top-10 card p-2 flex flex-col gap-1 min-w-32 z-50 shadow-lg">
                  {THEMES.map(t => (
                    <button
                      key={t}
                      onClick={() => { setTheme(t); setShowTheme(false) }}
                      className={`px-3 py-1.5 rounded-sm text-xs text-left capitalize transition-fast ${theme === t ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-secondary hover:bg-bg-surface'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification bell */}
            <button
              onClick={() => navigate('/portal/inbox')}
              className="relative w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-fast"
            >
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
            </button>

            {/* User info */}
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <span className="text-accent-primary font-semibold text-xs">
                  {user?.name?.[0]?.toUpperCase() ?? 'E'}
                </span>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-text-primary leading-tight">{user?.name ?? 'Employee'}</div>
                <div className="text-xs text-text-muted">{user?.department ?? 'Operations'}</div>
              </div>
              <button onClick={handleLogout} className="ml-1 text-text-muted hover:text-danger transition-fast" title="Logout">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
