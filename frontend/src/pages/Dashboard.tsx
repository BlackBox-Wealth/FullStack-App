import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { accountsAPI, transactionsAPI, adminAPI, mlAPI } from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, Banknote, Bot, Building2, Clock3, CreditCard, FileText, Languages, LineChart, LoaderCircle, Users } from 'lucide-react';
import AlertBanner from '../components/AlertBanner';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_PALETTE } from '../theme/chartTheme';
import { useTranslation } from '../hooks/useTranslation';

const COLORS = CHART_PALETTE;

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)',
};

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [spending, setSpending] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [forecastTrend, setForecastTrend] = useState<'UP' | 'DOWN' | null>(null);
  const [testText, setTestText] = useState('');
  const [categoryResult, setCategoryResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (user?.role === 'customer') {
        const [accRes, txnRes, spendRes, forecastRes] = await Promise.all([
          accountsAPI.getAll(),
          transactionsAPI.getAll({ limit: 10 }),
          mlAPI.spendingInsights(),
          mlAPI.forecastCashflow(30),
        ]);
        setAccounts(accRes.data);
        setTransactions(txnRes.data);
        setSpending(spendRes.data);
        setForecast(forecastRes.data.forecast || []);
        setForecastTrend(forecastRes.data.trend_direction ?? null);
        console.log('ML Cashflow Forecast:', forecastRes.data);
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

  const handleClassify = async () => {
    if (!testText.trim()) return;
    setClassifying(true);
    try {
      const res = await mlAPI.classifyTransaction(testText);
      setCategoryResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setClassifying(false);
    }
  };

  if (loading) {
    return <PageLoader label="Preparing dashboard" />;
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Customer Dashboard
  if (user?.role === 'customer') {
    const spendingChartData = spending?.insights?.map((c: any) => ({
      name: c.category,
      value: c.total_spent,
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
            <div className="stat-icon purple"><Building2 size={20} /></div>
            <div className="stat-value">₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-label">{t('dashboard.totalBalance')}</div>
            <div className="stat-change positive">↑ +2.5% this month</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Banknote size={20} /></div>
            <div className="stat-value">{accounts.length}</div>
            <div className="stat-label">{t('nav.accounts')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><CreditCard size={20} /></div>
            <div className="stat-value">{transactions.length}+</div>
            <div className="stat-label">{t('nav.transactions')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><LineChart size={20} /></div>
            <div className="stat-value">₹{(spending?.total_spending || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="stat-label">{t('nav.investments')}</div>
          </div>
        </div>

        <div className="grid-2">
          {/* Trend Chart */}
          <Motion3D delay={0.05}>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{t('dashboard.incomeVsExpense')}</div>
                  <div className="card-subtitle">{t('dashboard.weeklyOverview')}</div>
                </div>
              </div>
              <div className="chart-container" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="day" stroke={CHART_AXIS} fontSize={12} />
                    <YAxis stroke={CHART_AXIS} fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                    />
                    <Area type="monotone" dataKey="income" stroke={CHART_COLORS.primary} fillOpacity={1} fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                    <Area type="monotone" dataKey="expense" stroke={CHART_COLORS.accent} fillOpacity={1} fill="url(#expenseGrad)" strokeWidth={2} name="Expense" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Motion3D>

          {/* Spending Pie */}
          <Motion3D delay={0.12}>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{t('dashboard.spendingByCategory')}</div>
                  <div className="card-subtitle">{t('dashboard.last3Months')}</div>
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
                        contentStyle={tooltipStyle}
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
              
              {spending?.llm_reasoning && (
                <div style={{ padding: '0 20px 20px 20px' }}>
                  <div style={{ padding: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                    <Bot size={20} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
                    <span style={{ lineHeight: 1.5, width: '100%', fontWeight: 500 }}>{spending.llm_reasoning}</span>
                  </div>
                </div>
              )}
            </div>
          </Motion3D>
        </div>

        {/* AI Forecast Chart */}
        {forecast.length > 0 && (
          <Motion3D delay={0.16}>
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Bot size={17} /> AI Wealth Coach: Cashflow Prediction</div>
                  <div className="card-subtitle">Forecasted net amount for the next 30 days</div>
                </div>
                {forecastTrend && (
                  <div className={`badge-status ${forecastTrend === 'UP' ? 'verified' : 'rejected'}`} style={{ fontSize: '0.75rem' }}>
                    {forecastTrend === 'UP' ? '↑ Trending Up' : '↓ Trending Down'}
                  </div>
                )}
              </div>
              <div className="chart-container" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast}>
                    <defs>
                      <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="date" stroke={CHART_AXIS} fontSize={10} tickFormatter={(str) => str.split('-')[2]} />
                    <YAxis stroke={CHART_AXIS} fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Predicted Net']}
                    />
                    <Area type="monotone" dataKey="predicted_net_amount" stroke={CHART_COLORS.secondary} fillOpacity={1} fill="url(#forecastGrad)" strokeWidth={3} name="Predicted Net" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Motion3D>
        )}

        {/* AI Multilingual Categorizer */}
        <Motion3D delay={0.18}>
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Languages size={17} /> {t('nav.classifier')}</div>
                <div className="card-subtitle">AI-powered spending identifier (Supports English, Hindi, Punjabi)</div>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div className="form-group" style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Swiggy Order, बिजली बिल भुगतान, OLA ਰਾਈਡ"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleClassify}
                  disabled={classifying}
                >
                  {classifying ? <><LoaderCircle size={16} className="spin" /> Classifying...</> : 'Classify'}
                </button>
              </div>
              {categoryResult && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(15,118,110,0.08)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Predicted Category</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{categoryResult.category}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Confidence</span>
                    <strong style={{ color: categoryResult.confidence > 0.8 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                      {(categoryResult.confidence * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Motion3D>

        {/* Recent Transactions */}
        <Motion3D delay={0.22}>
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title">{t('nav.transactions')}</div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.description')}</th>
                    <th>{t('common.category')}</th>
                    <th>{t('common.amount')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('common.status')}</th>
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
        </Motion3D>
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
          <div className="stat-icon purple"><Users size={20} /></div>
          <div className="stat-value">{overview.total_users || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Building2 size={20} /></div>
          <div className="stat-value">{overview.total_accounts || 0}</div>
          <div className="stat-label">Active Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><CreditCard size={20} /></div>
          <div className="stat-value">{overview.total_transactions || 0}</div>
          <div className="stat-label">Total Transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><FileText size={20} /></div>
          <div className="stat-value">{overview.total_loans || 0}</div>
          <div className="stat-label">Loan Applications</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div className="stat-value">{overview.active_fraud_alerts || 0}</div>
          <div className="stat-label">Active Fraud Alerts</div>
        </div>
        {user?.role === 'super_admin' && (
          <div className="stat-card">
            <div className="stat-icon purple"><Clock3 size={20} /></div>
            <div className="stat-value">{overview.pending_kyc || 0}</div>
            <div className="stat-label">Pending KYC</div>
          </div>
        )}
      </div>

      {/* Transaction Volume Chart */}
      <Motion3D delay={0.1}>
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
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="_id" stroke={CHART_AXIS} fontSize={12} />
                <YAxis stroke={CHART_AXIS} fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="volume" stroke={CHART_COLORS.primary} fillOpacity={1} fill="url(#volumeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Motion3D>
    </div>
  );
};

export default Dashboard;
