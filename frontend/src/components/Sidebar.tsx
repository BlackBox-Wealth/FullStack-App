import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bot,
  CircleHelp,
  FileSearch,
  Goal,
  HandCoins,
  Landmark,
  LifeBuoy,
  LogOut,
  ScanFace,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
  Briefcase,
  Users,
  TrendingUp,
  Receipt,
  Activity,
  GraduationCap,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import logo from '../assets/wealth_vault_logo.png';

const roleNav: Record<string, { label: string; path: string; icon: React.ReactNode; section?: string }[]> = {
  customer: [
    { label: 'Accounts', path: '/accounts', icon: <Landmark size={18} /> },
    { label: 'Payments', path: '/payments', icon: <HandCoins size={18} /> },
    { label: 'Goals', path: '/goals', icon: <Goal size={18} />, section: 'Wealth' },
    { label: 'Wealth SIPs', path: '/sips', icon: <WalletCards size={18} /> },
    { label: 'Asset Vault', path: '/asset-vault', icon: <Briefcase size={18} /> },
    { label: 'Loans', path: '/loans', icon: <FileSearch size={18} /> },
    { label: 'Credit Score', path: '/credit-score', icon: <TrendingUp size={18} /> },
    { label: 'Tax Helper', path: '/tax', icon: <Receipt size={18} /> },
    { label: 'Family', path: '/family', icon: <Users size={18} />, section: 'Account' },
    { label: 'Verify Identity', path: '/kyc', icon: <ShieldCheck size={18} /> },
    { label: 'Active Sessions', path: '/sessions', icon: <ScanFace size={18} /> },
    { label: 'Recommendations', path: '/recommendations', icon: <Bot size={18} />, section: 'AI' },
    { label: 'What-if Scenarios', path: '/ai/scenarios', icon: <ShieldAlert size={18} /> },
    { label: 'Financial Agents', path: '/ai/agents', icon: <Bot size={18} /> },
    { label: 'Learn', path: '/learn', icon: <GraduationCap size={18} />, section: 'Help' },
    { label: 'FAQ', path: '/faq', icon: <CircleHelp size={18} /> },
    { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
  ],
  employee: [
    { label: 'Notifications', path: '/admin/notifications', icon: <ShieldAlert size={18} />, section: 'Operations' },
    { label: 'KYC Verification', path: '/admin/kyc', icon: <ShieldCheck size={18} /> },
    { label: 'Loans', path: '/admin/loans', icon: <FileSearch size={18} /> },
    { label: 'Learn', path: '/learn', icon: <GraduationCap size={18} />, section: 'Help' },
    { label: 'FAQ', path: '/faq', icon: <CircleHelp size={18} /> },
    { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
  ],
  relationship_manager: [
    { label: 'Notifications', path: '/admin/notifications', icon: <ShieldAlert size={18} />, section: 'Main' },
    { label: 'Risk Dashboard', path: '/admin/risk', icon: <ShieldAlert size={18} /> },
    { label: 'Users', path: '/admin/users', icon: <ScanFace size={18} /> },
    { label: 'KYC: Escalated', path: '/admin/kyc/escalated', icon: <ShieldAlert size={18} />, section: 'Operations' },
    { label: 'Fraud Alerts', path: '/admin/fraud', icon: <ShieldAlert size={18} /> },
    { label: 'Learn', path: '/learn', icon: <GraduationCap size={18} />, section: 'Help' },
    { label: 'FAQ', path: '/faq', icon: <CircleHelp size={18} /> },
    { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
  ],
  super_admin: [
    { label: 'Notifications', path: '/admin/notifications', icon: <ShieldAlert size={18} />, section: 'Main' },
    { label: 'Risk Dashboard', path: '/admin/risk', icon: <ShieldAlert size={18} /> },
    { label: 'Accounts', path: '/accounts', icon: <Landmark size={18} /> },
    { label: 'KYC Verification', path: '/admin/kyc', icon: <ShieldCheck size={18} />, section: 'Operations' },
    { label: 'Loans', path: '/admin/loans', icon: <FileSearch size={18} /> },
    { label: 'Fraud Alerts', path: '/admin/fraud', icon: <ShieldAlert size={18} /> },
    { label: 'System Performance', path: '/admin/performance', icon: <Activity size={18} /> },
    { label: 'Audit Logs', path: '/admin/audit', icon: <ScrollText size={18} />, section: 'Insights' },
    { label: 'Learn', path: '/learn', icon: <GraduationCap size={18} />, section: 'Help' },
    { label: 'FAQ', path: '/faq', icon: <CircleHelp size={18} /> },
    { label: 'Support', path: '/support', icon: <LifeBuoy size={18} /> },
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
        <img
          src={logo}
          alt="WealthVault Logo"
          style={{
            height: '32px',
            width: 'auto',
            display: 'block'
          }}
        />
        {sidebarOpen && <h1 style={{ marginLeft: '12px' }}>WealthVault</h1>}
      </div>

      <nav className="sidebar-nav" id="sidebar-nav" data-lenis-prevent>
        {navItems.map((item) => {
          const showSection = item.section && item.section !== currentSection;
          if (item.section) currentSection = item.section;

          return (
            <React.Fragment key={item.path}>
              {showSection && sidebarOpen && (
                <div className="sidebar-section-title" id={`section-${item.section.toLowerCase()}`}>{item.section}</div>
              )}
              <NavLink
                to={item.path}
                end
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
        {user.role === 'super_admin' && (
          <button
            className="nav-item"
            onClick={() => window.open(import.meta.env.VITE_TESTING_DASHBOARD_URL, '_blank')}
            style={{ width: '100%', border: 'none', background: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontFamily: 'var(--font-family)', marginBottom: '4px' }}
          >
            <span className="icon"><ExternalLink size={18} /></span>
            {sidebarOpen && <span>Testing Dashboard</span>}
          </button>
        )}
        <button
          id="logout-btn"
          className="nav-item"
          onClick={handleLogout}
          style={{ width: '100%', border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
        >
          <span className="icon"><LogOut size={18} /></span>
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;