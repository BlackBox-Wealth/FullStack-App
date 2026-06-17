import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { AlertTriangle, Bell, FileText, ShieldAlert, ShieldCheck } from 'lucide-react';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';

interface NotificationSummary {
  kyc_pending: number;
  kyc_escalated: number;
  loans_pending: number;
  fraud_alerts: number;
  total_alerts: number;
}

const AdminNotifications: React.FC = () => {
  const [data, setData] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await adminAPI.getNotificationSummary();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader label="Loading notifications" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} /> Notification Center
          </h2>
          <p>Real-time alerts and pending actions</p>
        </div>
        <div className="badge-status verified" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
          {data?.total_alerts || 0} Total Alerts
        </div>
      </div>

      <div className="stats-grid">
        <Motion3D delay={0.05}>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/admin/kyc'}>
            <div className="stat-icon yellow">
              <ShieldCheck size={20} />
            </div>
            <div className="stat-value">{data?.kyc_pending || 0}</div>
            <div className="stat-label">KYC Pending</div>
            <div className="stat-change" style={{ color: 'var(--warning)' }}>
              Requires verification
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.08}>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/admin/kyc/escalated'}>
            <div className="stat-icon blue">
              <ShieldAlert size={20} />
            </div>
            <div className="stat-value">{data?.kyc_escalated || 0}</div>
            <div className="stat-label">KYC Escalated</div>
            <div className="stat-change" style={{ color: 'var(--info)' }}>
              Manager review needed
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.11}>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/admin/loans'}>
            <div className="stat-icon orange">
              <FileText size={20} />
            </div>
            <div className="stat-value">{data?.loans_pending || 0}</div>
            <div className="stat-label">Loans Pending</div>
            <div className="stat-change" style={{ color: 'var(--warning)' }}>
              Awaiting approval
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.14}>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/admin/fraud'}>
            <div className="stat-icon red">
              <AlertTriangle size={20} />
            </div>
            <div className="stat-value">{data?.fraud_alerts || 0}</div>
            <div className="stat-label">Fraud Alerts</div>
            <div className="stat-change negative">
              Critical - Review immediately
            </div>
          </div>
        </Motion3D>
      </div>

      <Motion3D delay={0.18}>
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Quick Actions</div>
          </div>
          <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => window.location.href = '/admin/kyc'}
              disabled={!data?.kyc_pending}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <ShieldCheck size={18} />
              <span>Review {data?.kyc_pending || 0} Pending KYC Documents</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.location.href = '/admin/loans'}
              disabled={!data?.loans_pending}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <FileText size={18} />
              <span>Process {data?.loans_pending || 0} Loan Applications</span>
            </button>
            <button
              className="btn btn-danger"
              onClick={() => window.location.href = '/admin/fraud'}
              disabled={!data?.fraud_alerts}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <AlertTriangle size={18} />
              <span>Investigate {data?.fraud_alerts || 0} Fraud Alerts</span>
            </button>
          </div>
        </div>
      </Motion3D>

      {data && data.total_alerts === 0 && (
        <Motion3D delay={0.22}>
          <div className="card" style={{ marginTop: 24 }}>
            <div className="empty-state">
              <div className="icon" style={{ fontSize: '3rem' }}>✅</div>
              <h3>All Clear!</h3>
              <p>No pending notifications at this time. Great work!</p>
            </div>
          </div>
        </Motion3D>
      )}
    </div>
  );
};

export default AdminNotifications;
