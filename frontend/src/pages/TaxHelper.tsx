import React, { useEffect, useState } from 'react';
import { Receipt, Info, TrendingUp } from 'lucide-react';
import api from '../api';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';

interface TaxSummaryData {
  section_80c_limit: number;
  total_invested: number;
  remaining_limit: number;
  utilization_pct: number;
  tax_saving_investments: Array<{
    symbol: string;
    type: string;
    amount: number;
    invested_on: string;
  }>;
  potential_tax_saved: number;
  max_possible_savings: number;
  additional_savings_possible: number;
  suggestions: string[];
}

const TaxHelper: React.FC = () => {
  const [data, setData] = useState<TaxSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    loadTaxSummary();
  }, []);

  const loadTaxSummary = async () => {
    try {
      const res = await api.get('/tax/summary');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load tax summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader label="Calculating tax summary" />;
  if (!data) return <div className="empty-state"><p>Unable to load tax summary</p></div>;

  const getStatusColor = () => {
    if (data.utilization_pct >= 100) return '#10b981';
    if (data.utilization_pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, paddingBottom: 4 }}>
            Tax Helper
            <div
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
              <Info size={18} className="text-muted" style={{ cursor: 'help' }} />
              {showInfo && (
                <div style={{
                  position: 'absolute', top: 28, left: 0, width: 340, zIndex: 99999,
                  padding: '16px', fontSize: '0.85rem', fontWeight: 'normal',
                  color: '#E2E8F0', backgroundColor: '#1E1E2F',
                  border: '1px solid #334155', borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: 8, fontSize: '0.95rem' }}>
                    Section 80C Guide
                  </strong>
                  <strong style={{ color: '#818CF8' }}>Limit</strong>: ₹1,50,000 per financial year<br /><br />
                  <strong style={{ color: '#818CF8' }}>Tax Benefit</strong>: Up to ₹45,000 savings (30% bracket)<br /><br />
                  <strong style={{ color: '#818CF8' }}>Eligible</strong>: ELSS, PPF, NPS, Tax Saver FD, NSC, ULIP
                </div>
              )}
            </div>
          </h2>
          <p>Optimize your tax savings under Section 80C</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Receipt size={20} /></div>
          <div className="stat-value">₹{data.total_invested.toLocaleString()}</div>
          <div className="stat-label">Total Invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><TrendingUp size={20} /></div>
          <div className="stat-value">₹{data.remaining_limit.toLocaleString()}</div>
          <div className="stat-label">Remaining Limit</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Receipt size={20} /></div>
          <div className="stat-value">₹{data.potential_tax_saved.toLocaleString()}</div>
          <div className="stat-label">Tax Saved</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><TrendingUp size={20} /></div>
          <div className="stat-value">{data.utilization_pct}%</div>
          <div className="stat-label">Utilization</div>
        </div>
      </div>

      {/* Progress Bar */}
      <Motion3D delay={0.05}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Section 80C Utilization
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: getStatusColor() }}>
              ₹{data.total_invested.toLocaleString()} / ₹{data.section_80c_limit.toLocaleString()}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            maxWidth: 600,
            height: 20,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 12,
            overflow: 'hidden',
            margin: '0 auto',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(data.utilization_pct, 100)}%`,
              height: '100%',
              backgroundColor: getStatusColor(),
              transition: 'width 0.8s ease',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 12,
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {data.utilization_pct > 10 && `${data.utilization_pct}%`}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            maxWidth: 600,
            margin: '8px auto 0',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}>
            <span>₹0</span>
            <span>₹1,50,000</span>
          </div>

          {data.remaining_limit > 0 && (
            <div style={{
              marginTop: 24,
              padding: '12px 20px',
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              borderRadius: 12,
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              💡 You can save an additional ₹{data.additional_savings_possible.toLocaleString()} in taxes!
            </div>
          )}
        </div>
      </Motion3D>

      {/* Tax Saving Investments */}
      {data.tax_saving_investments.length > 0 && (
        <Motion3D delay={0.1}>
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">Your Tax-Saving Investments</div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Invested On</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tax_saving_investments.map((inv, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.symbol}</td>
                      <td style={{ fontSize: '0.85rem' }}>{inv.type}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        ₹{inv.amount.toLocaleString()}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(inv.invested_on).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Motion3D>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <Motion3D delay={0.15}>
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">💡 Tax Optimization Suggestions</div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                {data.suggestions.map((suggestion, idx) => (
                  <li key={idx} style={{
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    lineHeight: 1.6
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-primary)',
                      flexShrink: 0,
                      marginTop: 6
                    }} />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Motion3D>
      )}
    </div>
  );
};

export default TaxHelper;
