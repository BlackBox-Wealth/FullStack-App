import React, { useEffect, useState } from 'react';
import { investmentsAPI, accountsAPI } from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const FUND_OPTIONS = {
  equity: [
    { name: 'Wealth Growth Equity Fund', risk: 'High', return: '15.2%' },
    { name: 'Bluechip Largecap Fund', risk: 'Moderate', return: '12.8%' },
    { name: 'Midcap Opportunity Fund', risk: 'High', return: '18.4%' }
  ],
  debt: [
    { name: 'Secure Bond Fund', risk: 'Low', return: '7.5%' },
    { name: 'Short Term Debt Fund', risk: 'Low', return: '6.8%' },
    { name: 'Corporate Bond Fund', risk: 'Moderate', return: '8.2%' }
  ],
  hybrid: [
    { name: 'Balanced Advantage Fund', risk: 'Moderate', return: '11.5%' },
    { name: 'Equity Savings Fund', risk: 'Moderate', return: '9.8%' },
    { name: 'Multi-Asset Allocation Fund', risk: 'Moderate', return: '10.5%' }
  ]
};

const SIPs: React.FC = () => {
  const [sips, setSips] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdjust, setShowAdjust] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [projectionPeriod, setProjectionPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const [form, setForm] = useState({
    name: '',
    fund_category: 'equity',
    fund_name: '',
    amount: 5000,
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    account_id: '',
    step_up_pct: 10,
    goal_id: ''
  });

  const [adjustForm, setAdjustForm] = useState({
    amount: 0,
    frequency: '',
    status: '',
    step_up_pct: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sipRes, accRes, goalRes] = await Promise.all([
        investmentsAPI.getSIPs(),
        accountsAPI.getAll(),
        investmentsAPI.getGoals()
      ]);
      setSips(sipRes.data);
      setAccounts(accRes.data);
      setGoals(goalRes.data);
      if (accRes.data.length > 0) {
        setForm(f => ({ ...f, account_id: accRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.fund_name || !form.name) {
      alert("Please fill all details");
      return;
    }
    try {
      await investmentsAPI.createSIP(form);
      setShowCreate(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjust = async () => {
    try {
      await investmentsAPI.updateSIP(showAdjust.id, adjustForm);
      setShowAdjust(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSips = sips.filter(s => {
    if (activeFilter === 'all') return true;
    return s.status === activeFilter;
  });

  const totalInvested = sips.reduce((sum, s) => sum + s.total_invested, 0);
  const currentValue = sips.reduce((sum, s) => sum + s.current_value, 0);

  // Generate dynamic projection data
  const generateProjectionData = () => {
    const monthlySIP = sips.reduce((sum, s) => sum + (s.status === 'active' ? s.amount : 0), 0) || 5000;
    const avgRate = 0.12; // 12% average assumed return
    const data = [];

    if (projectionPeriod === 'weekly') {
      for (let i = 1; i <= 8; i++) {
        const invested = totalInvested + (monthlySIP / 4) * i;
        const growth = invested * (1 + (avgRate / 52) * i);
        data.push({ name: `W${i}`, invested, value: Math.round(growth) });
      }
    } else if (projectionPeriod === 'monthly') {
      for (let i = 1; i <= 6; i++) {
        const invested = totalInvested + monthlySIP * i;
        const growth = invested * (1 + (avgRate / 12) * i);
        data.push({ name: `M${i}`, invested, value: Math.round(growth) });
      }
    } else {
      // Yearly
      for (let i = 1; i <= 5; i++) {
        const invested = totalInvested + (monthlySIP * 12) * i;
        const growth = invested * Math.pow(1 + avgRate, i);
        data.push({ name: `Yr ${i}`, invested, value: Math.round(growth) });
      }
    }
    return data;
  };

  const chartData = generateProjectionData();

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="sips-page">
      <div className="page-header sticky-header">
        <div>
          <h2 className="gradient-text">Wealth SIP Dashboard</h2>
          <p>Compound your wealth with systematic, multi-period growth strategies</p>
        </div>
        <button className="btn btn-primary shadow-pulse" onClick={() => setShowCreate(true)}>
          🚀 Initiate New SIP
        </button>
      </div>

      <div className="performance-strip" style={{ marginBottom: 32 }}>
        <div className="stat-pod cyan">
          <div className="pod-label">Total Contribution</div>
          <div className="pod-values">
            <span className="pod-main">₹{totalInvested.toLocaleString()}</span>
            <span className="pod-badge">Lifetime</span>
          </div>
        </div>

        <div className="stat-pod gold">
          <div className="pod-label">Market Value</div>
          <div className="pod-values">
            <span className="pod-main text-accent">₹{currentValue.toLocaleString()}</span>
            <span className="pod-badge">Real-time</span>
          </div>
        </div>

        <div className="stat-pod emerald">
          <div className="pod-label">Wealth Gain</div>
          <div className="pod-values">
            <span className="pod-main text-success">+₹{(currentValue - totalInvested).toLocaleString()}</span>
            <span className="pod-badge success">+{((currentValue - totalInvested) / totalInvested * 100 || 0).toFixed(1)}%</span>
          </div>
        </div>

        <div className="stat-pod purple">
          <div className="pod-label">Monthly Momentum</div>
          <div className="pod-values">
            <span className="pod-main">₹{sips.reduce((sum, s) => sum + (s.status === 'active' ? s.amount : 0), 0).toLocaleString()}</span>
            <span className="pod-badge">Auto-Debit</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '32px' }}>
        <div className="card glass-premium">
          <div className="card-header flex-between">
            <h3 className="card-title">Wealth Growth Projection</h3>
            <div className="pills-container">
              <button className={`pill ${projectionPeriod === 'weekly' ? 'active' : ''}`} onClick={() => setProjectionPeriod('weekly')}>W</button>
              <button className={`pill ${projectionPeriod === 'monthly' ? 'active' : ''}`} onClick={() => setProjectionPeriod('monthly')}>M</button>
              <button className={`pill ${projectionPeriod === 'yearly' ? 'active' : ''}`} onClick={() => setProjectionPeriod('yearly')}>Y</button>
            </div>
          </div>

          <div style={{ height: 350, marginTop: 30 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ fontSize: '13px' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={4} fill="url(#colorValue)" animationDuration={1500} />
                <Area type="monotone" dataKey="invested" stroke="var(--text-muted)" fill="transparent" strokeDasharray="6 6" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="sip-legend compact">
            <span className="legend-item"><span className="dot primary"></span> Estimated Corpus</span>
            <span className="legend-item"><span className="dot secondary"></span> Capital Invested</span>
          </div>
        </div>

        <div className="card glass-premium">
          <h3 className="card-title">Asset Allocation</h3>
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Simple Bar Chart for Allocation */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { category: 'Equity', value: sips.filter(s => s.fund_category === 'equity').length },
                { category: 'Debt', value: sips.filter(s => s.fund_category === 'debt').length },
                { category: 'Hybrid', value: sips.filter(s => s.fund_category === 'hybrid').length }
              ]}>
                <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {[0, 1, 2].map((i) => <Cell key={i} fill={i === 0 ? 'var(--accent-primary)' : i === 1 ? 'var(--success)' : 'var(--warning)'} opacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="allocation-details">
            <div className="alloc-row">
              <span className="text-muted">High Risk (Equity)</span>
              <span className="badge-status active">{sips.filter(s => s.fund_category === 'equity').length} Plans</span>
            </div>
            <div className="alloc-row">
              <span className="text-muted">Stable (Debt)</span>
              <span className="badge-status">{sips.filter(s => s.fund_category === 'debt').length} Plans</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <div className="flex-between mb-2">
          <h3 className="section-title">My Systematic Portfolios</h3>
          <div className="segmented-control glass">
            {['all', 'active', 'paused', 'stopped'].map(f => {
              const count = f === 'all' ? sips.length : sips.filter(s => s.status === f).length;
              return (
                <button 
                  key={f} 
                  className={`segment-btn ${activeFilter === f ? 'active' : ''} ${f}`} 
                  onClick={() => setActiveFilter(f)}
                >
                  <span className="segment-label">{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                  {count > 0 && <span className="segment-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid-3" style={{ gap: '20px' }}>
          {filteredSips.map(sip => (
            <div key={sip.id} className="modern-sip-card">
              <div className="card-top">
                <div className="category-indicator" style={{ background: sip.fund_category === 'equity' ? 'var(--accent-primary)' : 'var(--success)' }}></div>
                <div className="sip-info">
                  <h4>{sip.name}</h4>
                  <p>{sip.fund_name}</p>
                </div>
                <div className={`status-dot ${sip.status}`}></div>
              </div>

              <div className="card-metrics">
                <div className="metric">
                  <span className="label">Monthly</span>
                  <span className="val">₹{sip.amount.toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="label">Growth</span>
                  <span className="val text-success">+{sip.profit_loss_pct}%</span>
                </div>
                <div className="metric">
                  <span className="label">Next Date</span>
                  <span className="val">{sip.next_installment}</span>
                </div>
              </div>

              <div className="card-actions-row">
                <button className="icon-btn" title="Adjust Plan" onClick={() => {
                  setShowAdjust(sip);
                  setAdjustForm({ amount: sip.amount, frequency: sip.frequency, status: sip.status, step_up_pct: sip.step_up_pct });
                }}>⚙️</button>

                {sip.status === 'active' ? (
                  <button className="action-btn pause" onClick={async () => {
                    await investmentsAPI.updateSIP(sip.id, { status: 'paused' });
                    loadData();
                  }}>Pause SIP</button>
                ) : (
                  <button className="action-btn resume" onClick={async () => {
                    await investmentsAPI.updateSIP(sip.id, { status: 'active' });
                    loadData();
                  }}>Resume SIP</button>
                )}

                <div className="risk-tag" data-risk={sip.risk_level.toLowerCase()}>{sip.risk_level}</div>
              </div>
            </div>
          ))}
          {filteredSips.length === 0 && (
            <div className="empty-state-card glass-glow" style={{ gridColumn: '1 / -1' }}>
              <p>No investment strategies found for this filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* SIP Creation Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal glass-modal shadow-2xl" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div className="header-content">
                <h3>🌊 Start Wealth Stream</h3>
                <p className="text-muted">Automated long-term systematic investing</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="modal-body scrollable-content">
              <div className="form-group floating">
                <label className="form-label">Strategic Name</label>
                <input className="form-input" placeholder="e.g., Early Retirement Plan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid-2 mt-4">
                <div className="form-group">
                  <label className="form-label">Asset Class</label>
                  <select className="form-select" value={form.fund_category} onChange={e => setForm({ ...form, fund_category: e.target.value, fund_name: '' })}>
                    <option value="equity">Equity (Aggressive)</option>
                    <option value="debt">Debt (Stable)</option>
                    <option value="hybrid">Hybrid (Balanced)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Destination Fund</label>
                  <select className="form-select" value={form.fund_name} onChange={e => setForm({ ...form, fund_name: e.target.value })}>
                    <option value="">Choose Fund...</option>
                    {FUND_OPTIONS[form.fund_category as keyof typeof FUND_OPTIONS].map(f => (
                      <option key={f.name} value={f.name}>{f.name} ({f.return} p.a.)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2 mt-4">
                <div className="form-group">
                  <label className="form-label">Monthly Ticket (₹)</label>
                  <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Auto-Increase (% / Year)</label>
                  <input type="number" className="form-input" value={form.step_up_pct} onChange={e => setForm({ ...form, step_up_pct: Number(e.target.value) })} />
                  <p className="hint text-muted">Counter inflation automatically</p>
                </div>
              </div>

              <div className="grid-2 mt-4">
                <div className="form-group">
                  <label className="form-label">Debit Start Date</label>
                  <input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Goal Target (Optional)</label>
                  <select className="form-select" value={form.goal_id} onChange={e => setForm({ ...form, goal_id: e.target.value })}>
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="future-preview-box glass">
                <div className="preview-header">
                  <span>Forecasted Wealth (15 Yrs)</span>
                  <span className="text-accent">₹{(form.amount * 12 * 15 * 4.2).toLocaleString()}</span>
                </div>
                <div className="progress-bar-small"><div className="fill" style={{ width: '70%', background: 'var(--accent-primary)' }}></div></div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary btn-full" onClick={handleCreate}>🚢 Launch SIP Strategy</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust SIP Modal */}
      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(null)}>
          <div className="modal glass-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Strategy Adjustment: {showAdjust.name}</h3>
              <button className="modal-close" onClick={() => setShowAdjust(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Modified Monthly Amount (₹)</label>
              <input type="number" className="form-input" value={adjustForm.amount} onChange={e => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">Update Annual Step-up (%)</label>
              <input type="number" className="form-input" value={adjustForm.step_up_pct} onChange={e => setAdjustForm({ ...adjustForm, step_up_pct: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">Current Status</label>
              <select className="form-select" value={adjustForm.status} onChange={e => setAdjustForm({ ...adjustForm, status: e.target.value as any })}>
                <option value="active">Active Execution</option>
                <option value="paused">Temporarily Paused</option>
                <option value="stopped">Permanently Stopped</option>
              </select>
            </div>
            <button className="btn btn-primary btn-full shadow-lg" onClick={handleAdjust}>
              Apply Structural Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SIPs;
