import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, RefreshCw } from 'lucide-react';
import { creditAPI } from '../api';
import Motion3D from '../components/animation/Motion3D';
import PageLoader from '../components/animation/PageLoader';

interface Factor {
  text: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface CreditScoreData {
  score: number;
  rating: string;
  factors: Factor[];
  score_delta: number;
  last_updated: string;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CreditScore: React.FC = () => {
  const [data, setData] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => { loadCreditScore(); }, []);

  const loadCreditScore = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await creditAPI.getScore();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load credit score:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <PageLoader label="Calculating credit score" />;
  if (!data) return <div className="empty-state"><p>Unable to load credit score</p></div>;

  const getRatingColor = () => {
    if (data.rating === 'Good') return '#10b981';
    if (data.rating === 'Average') return '#f59e0b';
    return '#ef4444';
  };

  const getProgressPct = () => Math.min(100, Math.max(0, ((data.score - 300) / 600) * 100));

  const positiveFactors = data.factors.filter(f => f.impact === 'positive');
  const negativeFactors = data.factors.filter(f => f.impact === 'negative');
  const neutralFactors = data.factors.filter(f => f.impact === 'neutral');

  const DeltaBadge = () => {
    if (data.score_delta > 0) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 20 }}>
        <TrendingUp size={13} /> +{data.score_delta} pts
      </span>
    );
    if (data.score_delta < 0) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: 20 }}>
        <TrendingDown size={13} /> {data.score_delta} pts
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 20 }}>
        <Minus size={13} /> No change
      </span>
    );
  };

  const FactorItem = ({ factor }: { factor: Factor }) => {
    const colors = {
      positive: { dot: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)' },
      negative: { dot: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.18)' },
      neutral:  { dot: '#94a3b8', bg: 'var(--bg-secondary)',  border: 'var(--border-color)' },
    };
    const c = colors[factor.impact];
    return (
      <li style={{ padding: '11px 16px', backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
        {factor.text}
      </li>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, paddingBottom: 4 }}>
            Credit Score
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}>
              <Info size={18} className="text-muted" style={{ cursor: 'help' }} />
              {showInfo && (
                <div style={{ position: 'absolute', top: 28, left: 0, width: 340, zIndex: 99999, padding: '16px', fontSize: '0.85rem', fontWeight: 'normal', color: '#E2E8F0', backgroundColor: '#1E1E2F', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: 8, fontSize: '0.95rem' }}>Credit Score Guide</strong>
                  Score is recalculated on every transaction using your real financial data.<br /><br />
                  <strong style={{ color: '#10b981' }}>Good (750–900)</strong>: Excellent financial health<br />
                  <strong style={{ color: '#f59e0b' }}>Average (600–749)</strong>: Moderate risk profile<br />
                  <strong style={{ color: '#ef4444' }}>Poor (300–599)</strong>: High risk — improve savings & reduce debt
                </div>
              )}
            </div>
          </h2>
          <p>Updated in real-time with every transaction</p>
        </div>
        <button className="btn btn-secondary" onClick={() => loadCreditScore(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Score card */}
      <Motion3D delay={0.05}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <TrendingUp size={30} style={{ color: getRatingColor() }} />
            <div style={{ fontSize: '4.5rem', fontWeight: 800, color: getRatingColor(), lineHeight: 1 }}>
              {data.score}
            </div>
            <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', alignSelf: 'flex-end', paddingBottom: 10 }}>/900</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-block', padding: '7px 22px', borderRadius: 24, fontSize: '1rem', fontWeight: 600, color: '#fff', backgroundColor: getRatingColor() }}>
              {data.rating}
            </span>
            <DeltaBadge />
          </div>

          {/* Progress bar with zones */}
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            <div style={{ position: 'relative', height: 18, backgroundColor: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {/* Zone colors */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ef4444 0%, #ef4444 33%, #f59e0b 33%, #f59e0b 58%, #10b981 58%, #10b981 100%)', opacity: 0.15 }} />
              {/* Actual score bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${getProgressPct()}%`, backgroundColor: getRatingColor(), transition: 'width 1s ease', borderRadius: 12 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>300 — Poor</span>
              <span>600 — Average</span>
              <span>750 — Good — 900</span>
            </div>
          </div>

          <p style={{ marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Last updated: {timeAgo(data.last_updated)}
          </p>
        </div>
      </Motion3D>

      {/* Factors */}
      {data.factors.length > 0 && (
        <Motion3D delay={0.12}>
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">Factors Affecting Your Score</div>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {positiveFactors.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', marginBottom: 10 }}>
                    Positive ({positiveFactors.length})
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {positiveFactors.map((f, i) => <FactorItem key={i} factor={f} />)}
                  </ul>
                </div>
              )}

              {negativeFactors.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ef4444', marginBottom: 10 }}>
                    Needs Improvement ({negativeFactors.length})
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {negativeFactors.map((f, i) => <FactorItem key={i} factor={f} />)}
                  </ul>
                </div>
              )}

              {neutralFactors.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                    Informational ({neutralFactors.length})
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {neutralFactors.map((f, i) => <FactorItem key={i} factor={f} />)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Motion3D>
      )}

      {/* How to improve */}
      {data.rating !== 'Good' && (
        <Motion3D delay={0.2}>
          <div className="card" style={{ marginTop: 24, padding: 24, border: '1px solid var(--accent-primary)', background: 'rgba(15,118,110,0.04)' }}>
            <h4 style={{ marginBottom: 12 }}>How to improve your score</h4>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Maintain a healthy account balance (₹1,00,000+)</li>
              <li>Keep spending below your income — save at least 20%</li>
              <li>Complete KYC verification if not done</li>
              <li>Avoid high-risk or unusual transactions</li>
              <li>Keep loan EMIs under 30% of monthly income</li>
            </ul>
          </div>
        </Motion3D>
      )}
    </div>
  );
};

export default CreditScore;
