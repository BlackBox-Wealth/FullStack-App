import React from 'react';
import { useAuthStore, useUIStore } from '../store';

const Header: React.FC<{ title: string }> = ({ title }) => {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  if (!user) return null;

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = user.role.replace('_', ' ');

  return (
    <header className={`header ${!sidebarOpen ? 'collapsed' : ''}`}>
      <div className="header-left">
        <button className="header-toggle" onClick={toggleSidebar} id="sidebar-toggle">
          ☰
        </button>
        <div>
          <div className="header-title">{title}</div>
        </div>
      </div>

      <div className="header-right">
        <div className="user-menu">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="name">{user.full_name}</div>
            <div className="role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
