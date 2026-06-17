import React, { useEffect, useState } from 'react';
import { mlAPI } from '../api';
import { AlertTriangle, Bot, Lightbulb, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';
import PageLoader from '../components/animation/PageLoader';

const Recommendations: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [recRes, insightRes] = await Promise.all([
        mlAPI.recommendations(),
        mlAPI.spendingInsights(),
      ]);
      setData(recRes.data);
      setInsights(insightRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <PageLoader label="Loading recommendations" />;

  const recommendations = data?.recommendations || [];
  const spendingInsights = insights?.insights || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Bot size={20} /> AI Recommendations</h2>
          <p>Personalized insights powered by machine learning</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} id="refresh-recs-btn">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Risk Profile */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white'
        }}>
          <Target size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your Risk Profile</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, textTransform: 'capitalize' }}>
            {data?.risk_profile || 'Moderate'}
          </div>
        </div>
      </div>

      {/* AI LLM Reasoning Panel */}
      {(data?.llm_explanation || data?.nudge) && (
        <div className="card" style={{ marginBottom: 24, padding: 20, background: 'linear-gradient(to right, rgba(15,118,110,0.05), rgba(76,29,149,0.05))', border: '1px solid rgba(15,118,110,0.2)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', marginBottom: 12, color: 'var(--accent-primary)' }}>
            <Bot size={18} /> Deep AI Reasoning
          </h3>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: data?.nudge ? 12 : 0 }}>
            {data?.llm_explanation}
          </p>
          {data?.nudge && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid var(--accent-secondary)' }}>
              <Lightbulb size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Behavioral Nudge:</strong> {data.nudge}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investment Recommendations */}
      <h3 style={{ marginBottom: 16, fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} /> Investment Recommendations</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
        {recommendations.map((rec: any, i: number) => (
          <div key={i} className="rec-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className={`action-badge ${rec.action?.toLowerCase()}`}>{rec.action}</span>
                <h4 style={{ marginTop: 8, fontSize: '1rem' }}>{rec.symbol}</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{rec.type}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {(rec.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              {rec.reason}
            </p>
            {rec.amount > 0 && (
              <div style={{ padding: '8px 12px', background: 'rgba(15,118,110,0.08)', borderRadius: 8, fontSize: '0.85rem' }}>
                <Lightbulb size={14} style={{ verticalAlign: 'text-top', marginRight: 6 }} /> Suggested: <strong>₹{rec.amount.toLocaleString()}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Spending Insights */}
      <h3 style={{ marginBottom: 16, fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} /> Spending Insights</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {spendingInsights.map((insight: any, i: number) => (
          <div key={i} className="card" style={{
            borderLeft: `4px solid ${insight.type === 'warning' ? 'var(--warning)' : insight.type === 'positive' ? 'var(--success)' : 'var(--info)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                  color: insight.type === 'warning' ? 'var(--warning)' : insight.type === 'positive' ? 'var(--success)' : 'var(--info)'
                }}>
                  {insight.type === 'warning' ? <AlertTriangle size={12} style={{ verticalAlign: 'text-top' }} /> : insight.type === 'positive' ? <TrendingUp size={12} style={{ verticalAlign: 'text-top' }} /> : <Lightbulb size={12} style={{ verticalAlign: 'text-top' }} />} {insight.category}
                </span>
                <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{insight.message}</p>
              </div>
              {insight.savings_potential > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Savings potential</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>₹{insight.savings_potential.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recommendations;
