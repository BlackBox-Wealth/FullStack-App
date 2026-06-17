import React, { useState, useEffect } from 'react';
import { sessionsAPI } from '../api';

interface DeviceInfo {
  browser: string;
  os: string;
  device_type: string;
}

interface Session {
  session_id: string;
  device_info: DeviceInfo;
  ip_address: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
  is_current: boolean;
}

const Sessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await sessionsAPI.getActiveSessions();
      setSessions(response.data);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to load sessions' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (session: Session) => {
    const isCurrent = session.is_current;
    const confirmMessage = isCurrent 
      ? 'Are you sure you want to revoke your CURRENT session? You will be logged out immediately.'
      : 'Are you sure you want to revoke this session? The device will be logged out immediately.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await sessionsAPI.revokeSession(session.session_id);
      
      if (response.data.logged_out) {
        // Redirection should happen via axios interceptor or manually here
        window.location.href = '/login';
        return;
      }

      setMessage({ type: 'success', text: 'Session revoked successfully' });
      fetchSessions();
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      
      if (status === 401) {
        window.location.href = '/login';
      } else if (status === 403) {
        setMessage({ 
          type: 'error', 
          text: 'You can only revoke your own sessions.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: detail || 'Failed to revoke session' 
        });
      }
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to log out all other devices? This cannot be undone.')) {
      return;
    }

    try {
      const response = await sessionsAPI.revokeAllSessions();
      const revokedCount = response.data.revoked_count || 0;
      setMessage({ 
        type: 'success', 
        text: `${revokedCount} session(s) revoked successfully` 
      });
      fetchSessions();
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to revoke sessions' 
      });
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return 'Mobile';
      case 'tablet':
        return 'Tablet';
      case 'desktop':
        return 'Desktop';
      default:
        return 'Device';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <h2>Active Sessions</h2>
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading sessions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2>Active Sessions</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
              Manage devices that are currently logged into your account
            </p>
          </div>
          {sessions.length > 1 && (
            <button 
              className="btn" 
              onClick={handleRevokeAllSessions}
              style={{ background: 'var(--danger)', color: 'white' }}
            >
              Revoke All Other Sessions
            </button>
          )}
        </div>

        {message && (
          <div 
            style={{ 
              padding: '12px', 
              borderRadius: '6px', 
              marginBottom: '16px',
              background: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24',
              border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
            }}
          >
            {message.text}
          </div>
        )}

        {sessions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '8px' 
          }}>
            <p style={{ fontSize: '20px', margin: '0 0 16px 0' }}>No Active Sessions</p>
            <p style={{ color: 'var(--text-secondary)' }}>No active sessions found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {sessions.map((session) => (
              <div 
                key={session.session_id}
                style={{
                  padding: '20px',
                  background: session.is_current ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                  border: session.is_current ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                  <div style={{ fontSize: '32px' }}>
                    {getDeviceIcon(session.device_info.device_type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '16px' }}>
                        {session.device_info.browser} on {session.device_info.os}
                      </strong>
                      {session.is_current && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'var(--accent-primary)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          Current Session
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <div>IP: {session.ip_address}</div>
                      <div>Created: {formatDate(session.created_at)}</div>
                      <div>Last Active: {formatDate(session.last_active)}</div>
                    </div>
                  </div>
                </div>
                <button 
                  className="btn"
                  onClick={() => handleRevokeSession(session)}
                  style={{ 
                    background: 'var(--danger)', 
                    color: 'white',
                    padding: '8px 16px'
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          background: 'rgba(255, 193, 7, 0.1)', 
          borderRadius: '8px',
          border: '1px solid rgba(255, 193, 7, 0.3)'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            <strong>Tip:</strong> If you see a session you don't recognize, revoke it immediately and change your password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sessions;
