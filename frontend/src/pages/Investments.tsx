import React, { useEffect, useState } from 'react';
import { investmentsAPI } from '../api';
import KYCGuard from '../components/KYCGuard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { CandlestickChart, CircleDollarSign, Crosshair, Rocket, TrendingDown, TrendingUp } from 'lucide-react';
import PageInfoButton from '../components/PageInfoButton';
import Motion3D from '../components/animation/Motion3D';
import { motion } from 'framer-motion';
import PageLoader from '../components/animation/PageLoader';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_PALETTE } from '../theme/chartTheme';
import { useAuthStore } from '../store';
import { Sparkles, X, Lightbulb } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import logo from '../assets/wealth_vault_logo.png';

const COLORS = CHART_PALETTE;

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)',
};

const Investments: React.FC = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [buyForm, setBuyForm] = useState({ investment_type: 'stocks', symbol: '', amount: 0, quantity: 0 });
  const [showNews, setShowNews] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [tips, setTips] = useState("");
  const [tipsLoading, setTipsLoading] = useState(false);
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const [MarkdownComp, setMarkdownComp] = useState<any>(null);

  useEffect(() => {
    // Dynamic import to handle cases where Vite might be slow to pick up the new dependency
    import('react-markdown').then(mod => {
      setMarkdownComp(() => mod.default);
    }).catch(() => {
      console.warn("ReactMarkdown failed to load, falling back to plain text");
    });
  }, []);

  useEffect(() => {
    loadData();
    if (user?.is_first_time_investor) {
      fetchFirstTimeTips();
    }
  }, []);

  const fetchFirstTimeTips = async () => {
    setTipsLoading(true);
    try {
      const res = await investmentsAPI.firstTimeTips();
      setTips(res.data.tips);
      setShowTips(true);
    } catch (e) {
      console.error("Failed to fetch first time tips", e);
    } finally {
      setTipsLoading(false);
    }
  };

  const handleDismissTips = async () => {
    setShowTips(false);
    try {
      await investmentsAPI.markInvested();
      if (user) {
        updateUser({ ...user, is_first_time_investor: false });
      }
    } catch (e) { console.error(e); }
  };

  const loadNews = async () => {
    if (news.length > 0) return;
    setNewsLoading(true);
    try {
      const res = await investmentsAPI.news();
      setNews(res.data);
    } catch (e) {
      console.error("Failed to load market news", e);
    } finally {
      setNewsLoading(false);
    }
  };

  useEffect(() => {
    if (showNews) loadNews();
  }, [showNews]);

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

  if (loading) return <PageLoader label="Loading..." />;

  const investments = portfolio?.investments || [];
  const portfolioByType = investments.reduce((acc: any, inv: any) => {
    acc[inv.investment_type] = (acc[inv.investment_type] || 0) + inv.current_value;
    return acc;
  }, {});
  const pieData = Object.entries(portfolioByType).map(([name, value]) => ({ name, value }));

  return (
    <KYCGuard>
      <div>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
              {t('investments.title')}
              <PageInfoButton
                pageTitle={t('investments.title')}
                items={[
                  { title: 'Portfolio Management', description: 'Track your holdings, total returns, and daily performance in real-time.' },
                  { title: 'Asset Allocation', description: 'Visual breakdown of your investments across different categories like Stocks, Mutual Funds, and Gold.' },
                  { title: 'Market Sentiment', description: 'AI-driven news aggregation to help you stay ahead of market trends.' }
                ]}
              />
            </h2>
            <p>Grow your wealth with AI-driven insights</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setShowNews(!showNews)}>
              {t('investments.marketNews')}
            </button>
            <button className="btn btn-primary" onClick={() => setShowBuy(true)} id="buy-investment-btn">
              {t('investments.newInvestment')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Left Panel: Financial News (Toggled) */}
          {showNews && (
            <div className="market-news-sidebar glass-premium card" style={{ width: 340, flexShrink: 0, height: 'calc(100vh - 180px)', overflowY: 'auto', position: 'sticky', top: 20 }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16, position: 'sticky', zIndex: 10, background: 'var(--bg-card)', top: '-24px', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <TrendingUp size={18} className="text-primary" /> India Markets Data
                    </h3>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>* Feeds may be delayed by up to 15 minutes</div>
                  </div>
                  <button className="btn btn-sm" style={{ padding: 6, background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setShowNews(false)}>✕</button>
                </div>
              </div>
              {newsLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading live BSE & NSE feeds...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 20 }}>
                  {news.map((item, idx) => (
                    <a key={idx} href={item.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.4, color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.pubDate).toLocaleString() || item.pubDate}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right Panel: Primary Investment Dashboard */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Portfolio Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon purple"><CircleDollarSign size={20} /></div>
                <div className="stat-value">₹{(portfolio?.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div className="stat-label">{t('investments.portfolioValue')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><TrendingUp size={20} /></div>
                <div className="stat-label">
                  P&L ({(portfolio?.total_profit_loss_pct || 0).toFixed(1)}%)
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Crosshair size={20} /></div>
                <div className="stat-value" style={{ textTransform: 'capitalize' }}>{portfolio?.risk_profile || 'N/A'}</div>
                <div className="stat-label">Risk Profile</div>
              </div>
            </div>

            <div className="grid-2">
              {/* Portfolio Allocation */}
              <Motion3D delay={0.08}>
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
                          <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']} />
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
              </Motion3D>

              {/* Holdings */}
              <Motion3D delay={0.12}>
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
              </Motion3D>
            </div>

            {/* Market Stocks */}
            <Motion3D delay={0.16}>
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CandlestickChart size={17} /> Market Overview</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>* Market data may be delayed by up to 15 minutes</span>
                </div>
                <div className="chart-container" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stocks.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="symbol" stroke={CHART_AXIS} fontSize={11} />
                      <YAxis stroke={CHART_AXIS} fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="price" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
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
            </Motion3D>

          </div> {/* End Right Panel Wrapper */}
        </div> {/* End Flex Row Layout Wrapper */}

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

        {/* First Time Tips Modal */}
        {showTips && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="modal glass-premium" 
              style={{ maxWidth: 500, padding: 0, overflow: 'hidden', border: '1px solid var(--accent-primary)' }}
            >
              <div style={{ 
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4338ca 100%)', 
                padding: '32px 24px', 
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: -10, left: 20, width: 60, height: 60, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                <button 
                  onClick={handleDismissTips}
                  style={{ position: 'absolute', right: 16, top: 16, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <img src={logo} alt="WealthVault" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>{t('tips.welcome')}, {user?.full_name.split(' ')[0]}!</h2>
                    <p style={{ opacity: 0.9, margin: 0, fontSize: '0.85rem' }}>Your AI Investment Journey Starts Here</p>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ background: 'rgba(15, 118, 110, 0.1)', padding: 6, borderRadius: 8 }}>
                    <Lightbulb size={20} />
                  </div>
                  <span>{t('tips.strategy')}</span>
                </div>
                
                <div className="markdown-content" style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  {tipsLoading ? (
                    <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
                      {t('tips.consulting')}
                    </div>
                  ) : MarkdownComp ? (
                    <div style={{ 
                      padding: '16px', 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '16px', 
                      border: '1px solid var(--border-color)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      <MarkdownComp>{tips}</MarkdownComp>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>{tips}</div>
                  )}
                </div>

                <div style={{ marginTop: 28 }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, boxShadow: '0 8px 20px rgba(15, 118, 110, 0.25)' }}
                    onClick={handleDismissTips}
                  >
                    {t('tips.gotIt')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </KYCGuard>
  );
};

export default Investments;
