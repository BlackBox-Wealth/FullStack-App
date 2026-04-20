import React, { useEffect, useState } from 'react';
import { investmentsAPI } from '../api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

const Investments: React.FC = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [buyForm, setBuyForm] = useState({ investment_type: 'stocks', symbol: '', amount: 0, quantity: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [portfolioRes, stocksRes] = await Promise.all([
        investmentsAPI.portfolio(),
        investmentsAPI.stocks(),
      ]);
      setPortfolio(portfolioRes.data);
      setStocks(stocksRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleBuy = async () => {
    try {
      await investmentsAPI.create(buyForm);
      setShowBuy(false);
      setBuyForm({ investment_type: 'stocks', symbol: '', amount: 0, quantity: 0 });
      loadData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const investments = portfolio?.investments || [];
  const portfolioByType = investments.reduce((acc: any, inv: any) => {
    acc[inv.investment_type] = (acc[inv.investment_type] || 0) + inv.current_value;
    return acc;
  }, {});
  const pieData = Object.entries(portfolioByType).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Investments</h2>
          <p>Track your portfolio and discover opportunities</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowBuy(true)} id="buy-investment-btn">
          + Buy Investment
        </button>
      </div>

      {/* Portfolio Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">💰</div>
          <div className="stat-value">₹{(portfolio?.total_invested || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Total Invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📈</div>
          <div className="stat-value">₹{(portfolio?.current_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Current Value</div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${(portfolio?.total_profit_loss || 0) >= 0 ? 'green' : 'red'}`}>
            {(portfolio?.total_profit_loss || 0) >= 0 ? '🚀' : '📉'}
          </div>
          <div className="stat-value" style={{ color: (portfolio?.total_profit_loss || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(portfolio?.total_profit_loss || 0) >= 0 ? '+' : ''}₹{(portfolio?.total_profit_loss || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">
            P&L ({(portfolio?.total_profit_loss_pct || 0).toFixed(1)}%)
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🎯</div>
          <div className="stat-value" style={{ textTransform: 'capitalize' }}>{portfolio?.risk_profile || 'N/A'}</div>
          <div className="stat-label">Risk Profile</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Portfolio Allocation */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Portfolio Allocation</div>
          </div>
          <div className="chart-container" style={{ height: 280 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1f35', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p>No investments yet</p></div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {pieData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                  <span style={{ textTransform: 'capitalize' }}>{item.name.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Holdings */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Holdings</div>
          </div>
          <div className="table-container" style={{ maxHeight: 350, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv: any) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.symbol}</td>
                    <td>{inv.quantity.toFixed(2)}</td>
                    <td style={{ fontFamily: 'monospace' }}>₹{inv.current_value.toLocaleString()}</td>
                    <td style={{ color: inv.profit_loss >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {inv.profit_loss >= 0 ? '+' : ''}₹{inv.profit_loss.toLocaleString()} ({inv.profit_loss_pct.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Market Stocks */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">📊 Market Overview</div>
        </div>
        <div className="chart-container" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stocks.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="symbol" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#1a1f35', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Bar dataKey="price" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-container" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock: any) => (
                <tr key={stock.symbol}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stock.symbol}</td>
                  <td>{stock.name}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>₹{stock.price.toLocaleString()}</td>
                  <td style={{ color: stock.change_pct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{(stock.volume / 1000000).toFixed(1)}M</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setBuyForm({ ...buyForm, symbol: stock.symbol, amount: stock.price, quantity: 1 });
                        setShowBuy(true);
                      }}
                    >
                      Buy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buy Modal */}
      {showBuy && (
        <div className="modal-overlay" onClick={() => setShowBuy(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Buy Investment</h3>
              <button className="modal-close" onClick={() => setShowBuy(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Symbol</label>
              <input className="form-input" value={buyForm.symbol} onChange={(e) => setBuyForm({ ...buyForm, symbol: e.target.value.toUpperCase() })} id="buy-symbol" />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" value={buyForm.quantity || ''} onChange={(e) => setBuyForm({ ...buyForm, quantity: Number(e.target.value) })} id="buy-quantity" />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input type="number" className="form-input" value={buyForm.amount || ''} onChange={(e) => setBuyForm({ ...buyForm, amount: Number(e.target.value) })} id="buy-amount" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleBuy} id="confirm-buy-btn">
              Confirm Purchase
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
