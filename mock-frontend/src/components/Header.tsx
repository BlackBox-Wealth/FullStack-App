import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  PanelLeft,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Lock,
  User,
  Settings,
  Flag,
  SunMedium,
  MoonStar,
  Palette,
} from 'lucide-react';
import { usePhishingStore, useUIStore } from '../store';
import { trackReportPhishing, trackClick } from '../tracker';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  title: string;
}

const employeeTabs = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Users', path: '/admin/users' },
  { label: 'Fraud Alerts', path: '/admin/fraud' },
  { label: 'Support', path: '/support' },
];

const THEMES = ['linen', 'midnight', 'sepia', 'aurora', 'graphite'] as const;

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user } = usePhishingStore();
  const { sidebarOpen, toggleSidebar, theme, cycleTheme } = useUIStore();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleReport = () => {
    trackReportPhishing();
    trackClick('header_report_suspicious');
    usePhishingStore.getState().triggerReveal();
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    trackClick('header_logout');
    usePhishingStore.getState().logout();
    window.location.href = '/';
  };

  const goTo = (path: string) => {
    trackClick('header_dropdown_nav', { path });
    setDropdownOpen(false);
    navigate(path);
  };

  if (!user) return null;

  const themeIcon = theme === 'linen'
    ? <SunMedium size={16} />
    : theme === 'midnight'
      ? <MoonStar size={16} />
      : <Palette size={16} />;

  return (
    <header className={`header${sidebarOpen ? '' : ' collapsed'}`}>
      {/* Left: toggle + kicker + title */}
      <div className="header-left">
        <button
          className="header-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          <PanelLeft size={18} />
        </button>
        <div>
          <div className="header-kicker">WealthVault / Employee</div>
          <div className="header-title">{title}</div>
        </div>
      </div>

      {/* Center: quick tabs */}
      <nav className="header-tabs">
        {employeeTabs.map(({ label, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `header-tab${isActive ? ' active' : ''}`}
            onClick={() => trackClick('header_tab', { label, path })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right: theme + bell + user menu */}
      <div className="header-right">
        {/* Theme toggle — matches main app */}
        <button
          className="header-action"
          onClick={cycleTheme}
          title="Cycle theme"
        >
          {themeIcon}
          <span>{theme}</span>
        </button>

        <NotificationBell />

        {/* User dropdown */}
        <div className="user-menu-container">
          <button
            className={`user-menu${dropdownOpen ? ' open' : ''}`}
            onClick={() => { setDropdownOpen((o) => !o); trackClick('header_user_menu'); }}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <div className="user-avatar">{user.initials}</div>
            <div className="user-info">
              <div className="name">{user.name}</div>
              <div className="role">Employee</div>
            </div>
            <ChevronDown
              size={14}
              className={`dropdown-chevron${dropdownOpen ? ' rotate' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {dropdownOpen && (
            <>
              <div className="dropdown-overlay" onClick={() => setDropdownOpen(false)} />
              <div className="user-dropdown-card">
                <div className="dropdown-header">
                  <div className="avatar-large">{user.initials}</div>
                  <div className="header-details">
                    <div className="full-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>

                <div className="dropdown-divider" />

                <div className="dropdown-links">
                  <button onClick={() => goTo('/settings/profile')} className="dropdown-item">
                    <User size={16} /> My Profile
                  </button>
                  <button onClick={() => goTo('/settings')} className="dropdown-item">
                    <Settings size={16} /> Settings
                  </button>
                  <button onClick={() => goTo('/sessions')} className="dropdown-item">
                    <ShieldCheck size={16} /> Security
                  </button>
                  <button onClick={() => goTo('/data-privacy')} className="dropdown-item">
                    <Lock size={16} /> Data Privacy
                  </button>
                  <button onClick={handleReport} className="dropdown-item" style={{ color: 'var(--danger)' }}>
                    <Flag size={16} /> Report Suspicious Email
                  </button>
                </div>

                <div className="dropdown-divider" />

                <button onClick={handleLogout} className="dropdown-item logout">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
