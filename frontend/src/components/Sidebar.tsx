import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../store';

const roleNav: Record<string, { label: string; path: string; icon: string; section?: string }[]> = {
  customer: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊', section: 'Main' },
    { label: 'Accounts', path: '/accounts', icon: '🏦' },
    { label: 'Transactions', path: '/transactions', icon: '💳' },
    { label: 'Payments', path: '/payments', icon: '💸' },
    { label: 'Investments', path: '/investments', icon: '📈', section: 'Wealth' },
    { label: 'Goals', path: '/goals', icon: '🎯' },
    { label: 'Wealth SIPs', path: '/sips', icon: '♾️' },
    { label: 'Loans', path: '/loans', icon: '📝' },
    { label: 'Recommendations', path: '/recommendations', icon: '🤖', section: 'AI' },
    { label: 'What-if Scenarios', path: '/ai/scenarios', icon: '🔮' },
  ],
  employee: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊', section: 'Main' },
    { label: 'Customers', path: '/admin/users', icon: '👥' },
    { label: 'KYC Verification', path: '/admin/kyc', icon: '✅', section: 'Operations' },
    { label: 'Loans', path: '/admin/loans', icon: '📝' },
    { label: 'Fraud Alerts', path: '/admin/fraud', icon: '🚨' },
  ],
  relationship_manager: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊', section: 'Main' },
    { label: 'Users', path: '/admin/users', icon: '👥' },
    { label: 'KYC Verification', path: '/admin/kyc', icon: '✅', section: 'Operations' },
    { label: 'Loans', path: '/admin/loans', icon: '📝' },
    { label: 'Fraud Alerts', path: '/admin/fraud', icon: '🚨' },
    { label: 'Analytics', path: '/admin/analytics', icon: '📈', section: 'Insights' },
  ],
  super_admin: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊', section: 'Main' },
    { label: 'Users', path: '/admin/users', icon: '👥' },
    { label: 'Accounts', path: '/accounts', icon: '🏦' },
    { label: 'KYC Verification', path: '/admin/kyc', icon: '✅', section: 'Operations' },
    { label: 'Loans', path: '/admin/loans', icon: '📝' },
    { label: 'Fraud Alerts', path: '/admin/fraud', icon: '🚨' },
    { label: 'Analytics', path: '/admin/analytics', icon: '📈', section: 'Insights' },
    { label: 'Audit Logs', path: '/admin/audit', icon: '📋' },
  ],
};

const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = roleNav[user.role] || roleNav.customer;
  let currentSection = '';

  const handleLogout = async () => {
    try {
      const { authAPI } = await import('../api');
      await authAPI.logout();
    } catch {
      // Even if backend call fails, clear local state
    }
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">W</div>
        {sidebarOpen && <h1>WealthVault</h1>}
      </div>

      <nav className="sidebar-nav">
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
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)' }}>
        <button
          id="logout-btn"
          className="nav-item"
          onClick={handleLogout}
          style={{ width: '100%', border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
        >
          <span className="icon">🚪</span>
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
