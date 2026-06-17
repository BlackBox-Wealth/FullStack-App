import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  CircleHelp,
  FileSearch,
  GraduationCap,
  LifeBuoy,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  PanelLeft,
} from 'lucide-react';
import { usePhishingStore, useUIStore } from '../store';
import { trackClick } from '../tracker';

const navItems: {
  label: string;
  path: string;
  icon: React.ReactNode;
  section?: string;
}[] = [
  { label: 'Notifications', path: '/admin/notifications', icon: <ShieldAlert size={18} />, section: 'Operations' },
  { label: 'KYC Verification', path: '/admin/kyc', icon: <ShieldCheck size={18} /> },
  { label: 'Loans', path: '/admin/loans', icon: <FileSearch size={18} /> },
  { label: 'Learn', path: '/learn', icon: <GraduationCap size={18} />, section: 'Help' },
  { label: 'FAQ', path: '/faq', icon: <CircleHelp size={18} /> },
  { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
];

const Sidebar: React.FC = () => {
  const { user } = usePhishingStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

  let currentSection = '';

  const handleLogout = () => {
    trackClick('sidebar_logout');
    usePhishingStore.getState().logout();
    navigate('/');
  };

  return (
    <div className={`sidebar${sidebarOpen ? '' : ' collapsed'}`}>
      {/* Logo — same style as main app */}
      <div className="sidebar-logo">
        <div className="logo-icon" style={{ fontSize: 14, fontWeight: 800 }}>WV</div>
        {sidebarOpen && <h1>WealthVault</h1>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" data-lenis-prevent>
        {navItems.map((item) => {
          const showSection = item.section && item.section !== currentSection;
          if (item.section) currentSection = item.section;

          return (
            <React.Fragment key={item.path}>
              {showSection && sidebarOpen && (
                <div className="sidebar-section-title">{item.section}</div>
              )}
              <NavLink
                to={item.path}
                end
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => trackClick('sidebar_nav', { label: item.label, to: item.path })}
              >
                <span className="icon">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)' }}>
        <button
          className="nav-item"
          onClick={handleLogout}
          style={{
            width: '100%',
            border: 'none',
            background: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
          }}
        >
          <span className="icon"><LogOut size={18} /></span>
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
