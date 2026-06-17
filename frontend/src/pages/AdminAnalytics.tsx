import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle, BadgeDollarSign, BarChart3, Building2, CreditCard, FileText, Radar, ScanSearch, ShieldCheck, Users } from 'lucide-react';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';
import { CHART_AXIS, CHART_COLORS, CHART_GRID } from '../theme/chartTheme';

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)',
};

const AdminAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [insiderThreats, setInsiderThreats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    try {
      const res = await adminAPI.getAnalytics();
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const runInsiderScan = async () => {
    setScanning(true);
    try {
      const res = await adminAPI.getInsiderThreats();
      setInsiderThreats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  if (loading) return <PageLoader label="Loading analytics" />;

  const overview = data?.overview || {};
  const trends = data?.monthly_trends || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><BarChart3 size={20} /> Analytics Dashboard</h2>
          <p>System-wide metrics and insights</p>
        </div>
        <button 
          className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'}`} 
          onClick={runInsiderScan}
          disabled={scanning}
        >
          {scanning ? <><Radar size={16} /> Scanning Graph...</> : <><ScanSearch size={16} /> Run Insider Threat Scan</>}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Users size={20} /></div>
          <div className="stat-value">{overview.total_users}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Building2 size={20} /></div>
          <div className="stat-value">{overview.total_accounts}</div>
          <div className="stat-label">Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><CreditCard size={20} /></div>
          <div className="stat-value">{overview.total_transactions}</div>
          <div className="stat-label">Transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><BadgeDollarSign size={20} /></div>
          <div className="stat-value">₹{((overview.total_transaction_volume || 0) / 100000).toFixed(1)}L</div>
          <div className="stat-label">Transaction Volume</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div className="stat-value">{overview.active_fraud_alerts}</div>
          <div className="stat-label">Fraud Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FileText size={20} /></div>
          <div className="stat-value">{overview.total_loans}</div>
          <div className="stat-label">Total Loans</div>
        </div>
      </div>

      <div className="grid-2">
        <Motion3D delay={0.08}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Monthly Transactions</div>
          </div>
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="_id" stroke={CHART_AXIS} fontSize={11} />
                <YAxis stroke={CHART_AXIS} fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Motion3D>

        <Motion3D delay={0.13}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Transaction Volume</div>
          </div>
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="_id" stroke={CHART_AXIS} fontSize={11} />
                <YAxis stroke={CHART_AXIS} fontSize={11} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']} />
                <Line type="monotone" dataKey="volume" stroke={CHART_COLORS.accent} strokeWidth={3} dot={{ fill: CHART_COLORS.accent, r: 5 }} name="Volume" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Motion3D>
      </div>

      {insiderThreats && (
        <Motion3D delay={0.16}>
        <div className="card" style={{ marginTop: 24, border: insiderThreats.threats_detected > 0 ? '1px solid var(--danger)' : '1px solid var(--success)' }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={17} /> Insider Threat Scan Results</div>
              <div className="card-subtitle">Relationship analysis between employees and customers</div>
            </div>
            <div className={`badge-status ${insiderThreats.threats_detected > 0 ? 'rejected' : 'verified'}`}>
              {insiderThreats.threats_detected > 0 ? 'THREATS DETECTED' : 'SYSTEM CLEAR'}
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Scan Status: <strong>{insiderThreats.status}</strong> | 
              Timestamp: <strong>{new Date(insiderThreats.scan_timestamp).toLocaleString()}</strong>
            </p>
            {insiderThreats.threats_detected > 0 ? (
              <div style={{ marginTop: 16 }}>
                {insiderThreats.alerts.map((alert: any, i: number) => (
                  <div key={i} style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <h4 style={{ color: '#ef4444' }}>Collusion Risk Detected</h4>
                    <p>{alert.message}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Risk Score: {(alert.risk_score * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: '#10b981' }}>
                No suspicious employee-customer relationships found in the current interaction graph.
              </div>
            )}
          </div>
        </div>
        </Motion3D>
      )}
    </div>
  );
};

export default AdminAnalytics;
