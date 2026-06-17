import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackClick } from '../tracker';

const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setCount(1);
  }, []);

  useEffect(() => {
    const handler = () => setCount(0);
    window.addEventListener('notificationsViewed', handler as EventListener);
    return () => window.removeEventListener('notificationsViewed', handler as EventListener);
  }, []);

  const handleClick = () => {
    trackClick('header_bell');
    setCount(0);
    navigate('/admin/notifications');
  };

  return (
    <button
      className="header-btn"
      aria-label="Notifications"
      onClick={handleClick}
    >
      <Bell size={18} />
      {count > 0 && <span className="badge">{count > 9 ? '9+' : count}</span>}
    </button>
  );
};

export default NotificationBell;
