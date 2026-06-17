import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { Activity, AlertTriangle, CreditCard, ShieldAlert, UserPlus } from 'lucide-react';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';

interface RiskSummary {
  risk_score: number;
  risk_level: string;
  breakdown: {
    fraud: number;
    transactions: number;
    otp: number;
    new_users: number;
  };
  timestamp: string;
  assessed_by: string;
}

const AdminRisk: React.FC = () => {
  const [data, setData] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRiskData();
    const interval = setInterval(loadRiskData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const loadRiskData = async () => {
    try {
      const res = await adminAPI.getRiskSummary();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader label="Calculating risk" />;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'var(--danger)';
      case 'MEDIUM': return 'var(--warning)';
      case 'LOW': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'HIGH': return 'rejected';
      case 'MEDIUM': return 'pending';
      case 'LOW': return 'verified';
      default: return 'pending';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} /> Risk Dashboard
          </h2>
          <p>Real-time system risk assessment</p>
        </div>
        <button className="btn btn-secondary" onClick={loadRiskData}>
          Refresh
        </button>
      </div>

      {/* Main Risk Score */}
      <Motion3D delay={0.05}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Overall System Risk Score
            </div>
            <div style={{ 
              fontSize: '5rem', 
              fontWeight: 700, 
              color: getRiskColor(data?.risk_level || 'LOW'),
              lineHeight: 1,
              marginBottom: 16
            }}>
              {data?.risk_score || 0}
            </div>
            <div className={`badge-status ${getRiskBadgeClass(data?.risk_level || 'LOW')}`} style={{ 
              fontSize: '1.1rem', 
              padding: '10px 24px',
              display: 'inline-block'
            }}>
              {data?.risk_level || 'UNKNOWN'} RISK
            </div>
            <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Last assessed: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>
      </Motion3D>

      {/* Risk Breakdown */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Risk Breakdown
        </h3>
      </div>

      <div className="stats-grid">
        <Motion3D delay={0.08}>
          <div className="stat-card">
            <div className="stat-icon red">
              <ShieldAlert size={20} />
            </div>
            <div className="stat-value">{data?.breakdown.fraud || 0}</div>
            <div className="stat-label">Fraud Risk</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Max: 40 points
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.11}>
          <div className="stat-card">
            <div className="stat-icon orange">
              <CreditCard size={20} />
            </div>
            <div className="stat-value">{data?.breakdown.transactions || 0}</div>
            <div className="stat-label">High-Value Transactions</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Max: 20 points
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.14}>
          <div className="stat-card">
            <div className="stat-icon yellow">
              <AlertTriangle size={20} />
            </div>
            <div className="stat-value">{data?.breakdown.otp || 0}</div>
            <div className="stat-label">OTP Failures</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Max: 20 points
            </div>
          </div>
        </Motion3D>

        <Motion3D delay={0.17}>
          <div className="stat-card">
            <div className="stat-icon blue">
              <UserPlus size={20} />
            </div>
            <div className="stat-value">{data?.breakdown.new_users || 0}</div>
            <div className="stat-label">New Users (7 days)</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Max: 20 points
            </div>
          </div>
        </Motion3D>
      </div>

      {/* Risk Level Guide */}
      <Motion3D delay={0.2}>
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Risk Level Guide</div>
          </div>
          <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success)' }} />
              <div>
                <strong style={{ color: 'var(--success)' }}>LOW (0-39)</strong>
                <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  System operating normally
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--warning)' }} />
              <div>
                <strong style={{ color: 'var(--warning)' }}>MEDIUM (40-69)</strong>
                <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Elevated risk - Monitor closely
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger)' }} />
              <div>
                <strong style={{ color: 'var(--danger)' }}>HIGH (70-100)</strong>
                <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Critical - Immediate action required
                </span>
              </div>
            </div>
          </div>
        </div>
      </Motion3D>

      {/* Assessed By */}
      {data?.assessed_by && (
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Assessed by: {data.assessed_by}
        </div>
      )}
    </div>
  );
};

export default AdminRisk;
