import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';

const AdminFraud: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    try {
      const res = await adminAPI.getFraudAlerts();
      setAlerts(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleResolve = async (alertId: string, resolution: string) => {
    await adminAPI.resolveFraudAlert(alertId, resolution);
    loadAlerts();
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🚨 Fraud Alerts</h2>
          <p>{alerts.filter(a => a.status === 'pending_review').length} pending review</p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon red">🚨</div>
          <div className="stat-value">{alerts.filter(a => a.status === 'pending_review').length}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">⚠️</div>
          <div className="stat-value">{alerts.filter(a => a.status === 'confirmed').length}</div>
          <div className="stat-label">Confirmed Fraud</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-value">{alerts.filter(a => a.status === 'false_positive').length}</div>
          <div className="stat-label">False Positives</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.map((alert) => (
          <div key={alert.id} className="card" style={{
            borderLeft: `4px solid ${alert.status === 'pending_review' ? 'var(--danger)' : alert.status === 'confirmed' ? 'var(--warning)' : 'var(--success)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className={`badge-status ${alert.status}`}>{alert.status.replace('_', ' ')}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Risk: <strong style={{ color: alert.risk_score > 0.8 ? 'var(--danger)' : 'var(--warning)' }}>
                      {(alert.risk_score * 100).toFixed(0)}%
                    </strong>
                  </span>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Amount: ₹{alert.amount?.toLocaleString()}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {alert.reason || 'Suspicious activity detected'}
                </p>
              </div>
              {alert.status === 'pending_review' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-danger" onClick={() => handleResolve(alert.id, 'confirmed')}>
                    Confirm Fraud
                  </button>
                  <button className="btn btn-sm btn-success" onClick={() => handleResolve(alert.id, 'false_positive')}>
                    False Positive
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="icon">🎉</div>
              <p>No fraud alerts. Everything looks clean!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFraud;
