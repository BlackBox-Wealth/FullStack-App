import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { accountsAPI, transactionsAPI, adminAPI } from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AlertBanner from '../components/AlertBanner';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [spending, setSpending] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (user?.role === 'customer') {
        const [accRes, txnRes, spendRes] = await Promise.all([
          accountsAPI.getAll(),
          transactionsAPI.getAll({ limit: 10 }),
          transactionsAPI.spendingAnalysis(3),
        ]);
        setAccounts(accRes.data);
        setTransactions(txnRes.data);
        setSpending(spendRes.data);
      } else {
        const [analyticsRes] = await Promise.all([adminAPI.getAnalytics()]);
        setAnalytics(analyticsRes.data);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Customer Dashboard
  if (user?.role === 'customer') {
    const spendingChartData = spending?.categories?.map((c: any) => ({
      name: c.category,
      value: c.total,
    })) || [];

    // Mock trend data
    const trendData = Array.from({ length: 7 }, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      income: Math.floor(Math.random() * 50000) + 10000,
      expense: Math.floor(Math.random() * 30000) + 5000,
    }));

    return (
      <div>
        {/* Alert Banner */}
        <AlertBanner />

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple">🏦</div>
            <div className="stat-value">₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-label">Total Balance</div>
            <div className="stat-change positive">↑ +2.5% this month</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">💰</div>
            <div className="stat-value">{accounts.length}</div>
            <div className="stat-label">Active Accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">💳</div>
            <div className="stat-value">{transactions.length}+</div>
            <div className="stat-label">Recent Transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">📈</div>
            <div className="stat-value">₹{(spending?.total_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-label">Spending (3 months)</div>
          </div>
        </div>

        <div className="grid-2">
          {/* Trend Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Income vs Expense</div>
                <div className="card-subtitle">Weekly overview</div>
              </div>
            </div>
            <div className="chart-container" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1f35', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="income" stroke="#6366f1" fillOpacity={1} fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#expenseGrad)" strokeWidth={2} name="Expense" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Spending Pie */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Spending by Category</div>
                <div className="card-subtitle">Last 3 months</div>
              </div>
            </div>
            <div className="chart-container" style={{ height: 280 }}>
              {spendingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spendingChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {spendingChartData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1f35', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '8px', color: '#f1f5f9' }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>No spending data yet</p></div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {spendingChartData.slice(0, 6).map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                    <span style={{ textTransform: 'capitalize' }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Recent Transactions</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 8).map((txn: any) => (
                  <tr key={txn.id}>
                    <td style={{ color: 'var(--text-primary)' }}>{txn.description || 'Transaction'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{txn.category}</td>
                    <td className={txn.transaction_type === 'credit' ? 'amount-credit' : 'amount-debit'} style={{ fontWeight: 600 }}>
                      {txn.transaction_type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{txn.transaction_type}</td>
                    <td><span className={`badge-status ${txn.status}`}>{txn.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Employee/RM Dashboard
  const overview = analytics?.overview || {};
  const trends = analytics?.monthly_trends || [];

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">👥</div>
          <div className="stat-value">{overview.total_users || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🏦</div>
          <div className="stat-value">{overview.total_accounts || 0}</div>
          <div className="stat-label">Active Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">💳</div>
          <div className="stat-value">{overview.total_transactions || 0}</div>
          <div className="stat-label">Total Transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📝</div>
          <div className="stat-value">{overview.total_loans || 0}</div>
          <div className="stat-label">Loan Applications</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🚨</div>
          <div className="stat-value">{overview.active_fraud_alerts || 0}</div>
          <div className="stat-label">Active Fraud Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">⏳</div>
          <div className="stat-value">{overview.pending_kyc || 0}</div>
          <div className="stat-label">Pending KYC</div>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Transaction Volume</div>
            <div className="card-subtitle">Monthly trend</div>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            ₹{(overview.total_transaction_volume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="chart-container" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="_id" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1a1f35', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Area type="monotone" dataKey="volume" stroke="#6366f1" fillOpacity={1} fill="url(#volumeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
