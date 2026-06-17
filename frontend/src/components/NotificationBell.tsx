import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Skeleton } from 'boneyard-js/react';
import api from '../api';

interface Notification {
  type: 'fraud' | 'transaction' | 'family';
  message: string;
  timestamp: string;
  status: 'info' | 'warning' | 'critical';
}

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/unified');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'critical') return '#ef4444';
    if (status === 'warning') return '#f59e0b';
    return '#2563eb';
  };

  const getTypeIcon = (type: string) => {
    if (type === 'fraud') return '🚨';
    if (type === 'family') return '👨‍👩‍👧';
    return '💳';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="header-btn"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {notifications.length > 0 && (
          <span className="badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: 380,
              maxHeight: 500,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Notifications</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {notifications.length} new
              </span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: 420,
              }}
            >
              {loading ? (
                <Skeleton
                  name="notification-bell-panel"
                  loading
                  animate="shimmer"
                  fallback={
                    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} style={{ height: 48, borderRadius: 10, background: 'var(--bg-secondary)' }} />
                      ))}
                    </div>
                  }
                >
                  <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} style={{ height: 48, borderRadius: 10, background: 'var(--bg-secondary)' }} />
                    ))}
                  </div>
                </Skeleton>
              ) : notifications.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>No notifications</p>
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getStatusColor(notif.status),
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{getTypeIcon(notif.type)}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            color: getStatusColor(notif.status),
                            letterSpacing: '0.5px',
                          }}
                        >
                          {notif.type}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                          margin: '0 0 6px 0',
                          lineHeight: 1.4,
                        }}
                      >
                        {notif.message}
                      </p>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
