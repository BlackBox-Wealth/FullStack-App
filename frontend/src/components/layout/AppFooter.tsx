import React from 'react';
import { NavLink } from 'react-router-dom';

const AppFooter: React.FC = () => {
  return (
    <footer className="app-footer">
      <div>
        <div className="app-footer__brand">WealthVault</div>
        <p>
          Finance, fraud signals, and AI guidance in one place. Built for clarity, not clutter.
        </p>
      </div>
      <div className="app-footer__links">
        <NavLink to="/faq">FAQ</NavLink>
        <NavLink to="/support">Support</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </div>
    </footer>
  );
};

export default AppFooter;
