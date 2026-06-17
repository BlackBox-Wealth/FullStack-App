import React, { useEffect, useState } from 'react';
import { notificationsAPI } from '../api';
import { AlertTriangle, Siren, X } from 'lucide-react';

const AlertBanner: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await notificationsAPI.getAlerts(false); // Only unread
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await notificationsAPI.markAlertRead(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {alerts.map((alert) => {
        const isHighRisk = alert.risk_score > 0.7;
        const bgColor = isHighRisk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';
        const borderColor = isHighRisk ? 'var(--danger)' : 'var(--warning)';

        return (
          <div
            key={alert.id}
            style={{
              background: bgColor,
              border: `1px solid ${borderColor}`,
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: 'var(--border-radius)',
              padding: '16px 20px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              animation: 'slideDown 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', gap: 16, flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, color: borderColor }}>
                {isHighRisk ? <Siren size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: borderColor }}>
                    {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: borderColor,
                      color: 'white',
                    }}
                  >
                    Risk: {(alert.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {alert.reason}
                </p>
                {alert.amount && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', fontWeight: 600 }}>
                    Amount: ₹{alert.amount.toLocaleString('en-IN')}
                  </p>
                )}
                <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(alert.created_at).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AlertBanner;
