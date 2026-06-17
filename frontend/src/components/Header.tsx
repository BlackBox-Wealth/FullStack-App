import React from 'react';
import toast from 'react-hot-toast';
import { NavLink, useNavigate } from 'react-router-dom';
import { Accessibility, Mic, MoonStar, Palette, PanelLeft, SunMedium, Volume2, ChevronDown, User, Settings as SettingsIcon, LogOut, ShieldCheck, Lock } from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import NotificationBell from './NotificationBell';
import { useTranslation } from '../hooks/useTranslation';

const quickTabsByRole: Record<string, { labelKey: string; path: string }[]> = {
  customer: [
    { labelKey: 'dashboard', path: '/dashboard' },
    { labelKey: 'transactions', path: '/transactions' },
    { labelKey: 'investments', path: '/investments' },
    { labelKey: 'support', path: '/support' },
    { labelKey: 'settings', path: '/settings' },
    { labelKey: 'learn', path: '/learn' },
  ],
  employee: [
    { labelKey: 'dashboard', path: '/dashboard' },
    { labelKey: 'family', path: '/admin/users' },
    { labelKey: 'scenarios', path: '/admin/fraud' },
    { labelKey: 'support', path: '/support' },
  ],
  relationship_manager: [
    { labelKey: 'dashboard', path: '/dashboard' },
    { labelKey: 'assets', path: '/admin/analytics' },
    { labelKey: 'loans', path: '/admin/loans' },
    { labelKey: 'support', path: '/support' },
  ],
  super_admin: [
    { labelKey: 'dashboard', path: '/dashboard' },
    { labelKey: 'family', path: '/admin/users' },
    { labelKey: 'assets', path: '/admin/analytics' },
    { labelKey: 'support', path: '/support' },
  ],
};

const Header: React.FC<{ title: string }> = ({ title }) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, themeMode, toggleThemeMode, accessibility, updateAccessibility } = useUIStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { authAPI } = await import('../api');
      await authAPI.logout();
    } catch {
      // Clear local state anyway
    }
    logout();
    setDropdownOpen(false);
    toast.success(t('header.logoutSuccess'));
    navigate('/login');
  };

  if (!user) return null;

  const initials = user.full_name
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = t(`header.roles.${user.role}`);
  const quickTabs = quickTabsByRole[user.role] || quickTabsByRole.customer;

  return (
    <header className={`header ${!sidebarOpen ? 'collapsed' : ''}`}>
      <div className="header-left">
        <button className="header-toggle" onClick={toggleSidebar} id="sidebar-toggle" aria-label="Toggle navigation">
          <PanelLeft size={18} />
        </button>
        <div>
          <div className="header-kicker">WealthVault / {roleLabel}</div>
          <div className="header-title">{title}</div>
        </div>
      </div>

      <div className="header-tabs" aria-label="Quick navigation" id="header-tabs">
        {quickTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `header-tab ${isActive ? 'active' : ''}`}
          >
            {t(`nav.${tab.labelKey}`)}
          </NavLink>
        ))}
      </div>
      <div className="header-right">
        <div className="accessibility-menu" id="accessibility-menu">
          <button
            type="button"
            className="header-action"
            onClick={() => navigate('/settings#accessibility')}
            aria-label="Accessibility Settings"
          >
            <Accessibility size={16} />
          </button>
          <div className="accessibility-dropdown">
            <button
              className={`accessibility-dropdown-item ${accessibility.voiceNavigation ? 'active' : ''}`}
              onClick={() => updateAccessibility({ voiceNavigation: !accessibility.voiceNavigation })}
            >
              <Mic size={16} /> {t('header.accessibility.voice')}
            </button>
            <button
              className={`accessibility-dropdown-item ${accessibility.screenReader ? 'active' : ''}`}
              onClick={() => updateAccessibility({ screenReader: !accessibility.screenReader })}
            >
              <Volume2 size={16} /> {t('header.accessibility.screen')}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="header-action"
          id="theme-toggle"
          onClick={toggleThemeMode}
          aria-label="Cycle theme"
        >
          {themeMode === 'linen' ? <SunMedium size={16} /> : themeMode === 'midnight' ? <MoonStar size={16} /> : <Palette size={16} />}
          <span>{themeMode}</span>
        </button>
        <NotificationBell />
        <div className="user-menu-container">
          <button
            className={`user-menu ${dropdownOpen ? 'open' : ''}`}
            id="user-menu"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="name">{user.full_name}</div>
              <div className="role">{roleLabel}</div>
            </div>
            <ChevronDown size={14} className={`dropdown-chevron ${dropdownOpen ? 'rotate' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div className="dropdown-overlay" onClick={() => setDropdownOpen(false)} />
              <div className="user-dropdown-card">
                <div className="dropdown-header">
                  <div className="avatar-large">{initials}</div>
                  <div className="header-details">
                    <div className="full-name">{user.full_name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>

                <div className="dropdown-divider" />

                <div className="dropdown-links">
                  <button onClick={() => { navigate('/settings#profile'); setDropdownOpen(false); }} className="dropdown-item">
                    <User size={16} /> {t('header.myProfile')}
                  </button>
                  <button onClick={() => { navigate('/settings'); setDropdownOpen(false); }} className="dropdown-item">
                    <SettingsIcon size={16} /> {t('common.settings')}
                  </button>
                  <button onClick={() => { navigate('/sessions'); setDropdownOpen(false); }} className="dropdown-item">
                    <ShieldCheck size={16} /> {t('header.security')}
                  </button>
                  <button onClick={() => { navigate('/data-privacy'); setDropdownOpen(false); }} className="dropdown-item">
                    <Lock size={16} /> {t('header.dataPrivacy')}
                  </button>
                </div>

                <div className="dropdown-divider" />

                <button onClick={handleLogout} className="dropdown-item logout">
                  <LogOut size={16} /> {t('common.logout')}
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
