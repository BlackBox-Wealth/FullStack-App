import React, { useEffect, useState, useCallback } from 'react';
import { investmentsAPI, budgetsAPI } from '../api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FiTarget, FiAlertCircle, FiPlus, FiTrash2, FiTrendingUp, FiTrendingDown, FiCheckCircle, FiClock, FiZap } from 'react-icons/fi';
import PageInfoButton from '../components/PageInfoButton';
import PageLoader from '../components/animation/PageLoader';

interface GoalInsight {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  deadline: string;
  months_to_deadline: number;
  months_to_goal: number | null;
  projected_completion: string | null;
  is_on_track: boolean;
  months_delay: number;
  projected_savings_by_deadline: number;
  required_monthly: number | null;
}

interface SmartInsights {
  avg_monthly_savings: number;
  total_saveable: number;
  budget_count: number;
  budget_stats: { category: string; limit: number; spent: number; remaining: number; status: string; saveable: number }[];
  goal_insights: GoalInsight[];
  groq_insight: string | null;
}

const Goals: React.FC = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [insights, setInsights] = useState<SmartInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: 0, current_amount: 0, deadline: '', funding_channels: [] as string[] });
  const [budgetForm, setBudgetForm] = useState({ category: 'General', amount_limit: 1000 });
  const [channelInput, setChannelInput] = useState('');

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await investmentsAPI.smartGoalInsights();
      setInsights(res.data);
    } catch (e) {
      console.error('Smart insights failed', e);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, budgetsRes] = await Promise.all([
        investmentsAPI.getGoals(),
        budgetsAPI.getAll(),
      ]);
      setGoals(goalsRes.data);
      setBudgets(budgetsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    loadInsights();
  }, [loadData, loadInsights]);

  // Re-fetch insights whenever spending data changes (after any mutation)
  const refreshAll = useCallback(async () => {
    await loadData();
    await loadInsights();
  }, [loadData, loadInsights]);

  const createGoal = async () => {
    try {
      await investmentsAPI.createGoal(form);
      setShowCreate(false);
      setForm({ name: '', target_amount: 0, current_amount: 0, deadline: '', funding_channels: [] });
      setChannelInput('');
      refreshAll();
    } catch (err) { console.error(err); }
  };

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await budgetsAPI.create(budgetForm);
      setShowAddBudget(false);
      toast.success(`Budget set for ${budgetForm.category}`);
      refreshAll();
    } catch (err) { toast.error('Failed to set budget'); }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this goal?')) return;
    try {
      await investmentsAPI.deleteGoal(id);
      toast.success('Goal removed');
      refreshAll();
    } catch (err) { toast.error('Failed to remove goal'); }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this budget limit?')) return;
    try {
      await budgetsAPI.delete(id);
      toast.success('Budget removed');
      refreshAll();
    } catch (err) { toast.error('Failed to remove budget'); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'exceeded': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  const findInsightForGoal = (goalId: string): GoalInsight | undefined =>
    insights?.goal_insights.find(g => g.goal_id === goalId);

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <PageLoader label="Loading goals" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
            Financial Goals
            <PageInfoButton
              pageTitle="Goals"
              items={[
                { title: 'Funding Channels', description: 'Customized tracking identifying exact income sources intended to fund your specific goal.' },
                { title: 'Spending Limits', description: 'Automated budgeting guardrails protecting your goals by limiting discretionary transaction expenses.' },
                { title: 'Goal Progress', description: 'Real-time tracking of your progress towards each goal with current amount versus target amount.' }
              ]}
            />
          </h2>
          <p>Track and achieve your financial dreams</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-goal-btn">
          + New Goal
        </button>
      </div>

      {/* ── Smart Savings Insights Banner ───────────────────────────────────── */}
      {(insights || insightsLoading) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 28,
          }}
        >
          {insightsLoading && !insights ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Analysing your spending habits…</div>
          ) : insights && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <FiZap size={18} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Smart Savings Analysis
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Based on {insights.budget_count} spending {insights.budget_count === 1 ? 'category' : 'categories'}
                </span>
              </div>

              {/* Average savings callout */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: insights.groq_insight ? 16 : 0 }}>
                <div style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  flex: '0 0 auto',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Avg. monthly savings potential</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiTrendingUp size={18} />
                    ₹{fmt(insights.avg_monthly_savings)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    avg remaining across {insights.budget_count} budget{insights.budget_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Per-budget mini pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {insights.budget_stats.map(b => (
                    <div key={b.category} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 20,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${getStatusColor(b.status)}40`,
                      fontSize: '0.78rem',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(b.status), display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{b.category}</span>
                      <span style={{ color: b.remaining >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                        {b.remaining >= 0 ? '+' : ''}₹{fmt(b.remaining)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Groq AI insight */}
              {insights.groq_insight && (
                <div style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  borderRadius: 10,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>AI Insight · </span>
                  {insights.groq_insight}
                </div>
              )}

              {insights.budget_count === 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Set spending limits below to unlock savings projections for your goals.
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ── Goal Cards ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {goals.map((goal) => {
          const gi = findInsightForGoal(goal.id);
          return (
            <div key={goal.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{goal.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Deadline: {goal.deadline}</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {gi && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: gi.is_on_track ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: gi.is_on_track ? 'var(--success)' : 'var(--danger)',
                      border: `1px solid ${gi.is_on_track ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}>
                      {gi.is_on_track ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
                      {gi.is_on_track ? 'On Track' : `+${gi.months_delay}mo delay`}
                    </span>
                  )}
                  <span className={`badge-status ${goal.status}`}>{goal.status}</span>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
                    title="Remove Goal"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>₹{goal.current_amount.toLocaleString()}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{goal.target_amount.toLocaleString()}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(goal.progress_pct, 100)}%` }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                {goal.progress_pct.toFixed(1)}%
              </div>

              {/* ── Per-goal smart projection ── */}
              {gi && insights && insights.avg_monthly_savings > 0 && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  background: gi.is_on_track ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${gi.is_on_track ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Monthly contribution</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {gi.is_on_track ? <FiTrendingUp size={13} color="var(--success)" /> : <FiTrendingDown size={13} color="var(--danger)" />}
                        ₹{fmt(insights.avg_monthly_savings)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required/month</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: gi.required_monthly && insights.avg_monthly_savings >= gi.required_monthly ? 'var(--success)' : 'var(--warning)' }}>
                        ₹{gi.required_monthly ? fmt(gi.required_monthly) : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Projected by deadline</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{fmt(gi.projected_savings_by_deadline)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FiClock size={10} /> Est. completion
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: gi.is_on_track ? 'var(--success)' : 'var(--danger)' }}>
                        {gi.projected_completion ?? '—'}
                      </div>
                    </div>
                  </div>

                  {!gi.is_on_track && (
                    <div style={{
                      marginTop: 10,
                      padding: '7px 10px',
                      background: 'rgba(239,68,68,0.08)',
                      borderRadius: 7,
                      fontSize: '0.78rem',
                      color: 'var(--danger)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                    }}>
                      <FiAlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                      At current spending habits, this goal will be delayed by ~{gi.months_delay} month{gi.months_delay !== 1 ? 's' : ''}.
                      Reduce spending by ₹{gi.required_monthly ? fmt(gi.required_monthly - insights.avg_monthly_savings) : '—'}/mo to stay on track.
                    </div>
                  )}
                  {gi.is_on_track && (
                    <div style={{
                      marginTop: 10,
                      padding: '7px 10px',
                      background: 'rgba(34,197,94,0.08)',
                      borderRadius: 7,
                      fontSize: '0.78rem',
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <FiCheckCircle size={13} />
                      Your spending habits support this goal. Keep it up!
                    </div>
                  )}
                </div>
              )}

              {gi && insights && insights.avg_monthly_savings === 0 && (
                <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  All budgets are currently over-spent — review your limits to unlock projections.
                </div>
              )}

              {goal.funding_channels && goal.funding_channels.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {goal.funding_channels.map((chan: string, i: number) => (
                    <span key={i} style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '20px',
                      color: 'var(--accent-primary)',
                    }}>
                      {chan}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="icon">Goal</div>
            <p>No financial goals yet. Create your first goal!</p>
          </div>
        )}
      </div>

      {/* ── Healthy Habits: Spending Limits ───────────────────────────────────── */}
      <div style={{ marginTop: 48, borderTop: '1px solid var(--border-color)', paddingTop: 32 }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2>Healthy Habits: Spending Limits</h2>
            <p>Control your expenses and save more for your goals</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowAddBudget(true)}>
            <FiPlus /> Set Spending Limit
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
          {budgets.map((b) => {
            const bs = insights?.budget_stats.find(s => s.category === b.category);
            return (
              <div key={b.id} className="card budget-card" style={{ borderLeft: `4px solid ${getStatusColor(b.status)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'capitalize' }}>{b.category}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly Limit: ₹{b.amount_limit}</p>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: getStatusColor(b.status) }}>
                        ₹{b.current_spent}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent so far</p>
                    </div>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, marginTop: 4 }}
                      title="Remove Limit"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="progress-bar" style={{ height: 10, marginBottom: 12 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((b.current_spent / b.amount_limit) * 100, 100)}%` }}
                    className="progress-fill"
                    style={{ backgroundColor: getStatusColor(b.status) }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.status === 'healthy' ? <FiTarget /> : <FiAlertCircle />}
                    {b.remaining >= 0 ? `₹${b.remaining} remaining` : `Exceeded by ₹${Math.abs(b.remaining)}`}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: getStatusColor(b.status), textTransform: 'uppercase', fontWeight: 700 }}>
                    {b.status}
                  </span>
                </div>

                {/* Saveable contribution from this category */}
                {bs && bs.saveable > 0 && (
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FiTrendingUp size={12} />
                    Contributes ₹{fmt(bs.saveable)} to your monthly savings potential
                  </div>
                )}
                {bs && bs.saveable === 0 && (
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FiTrendingDown size={12} />
                    Over-spent — no savings contribution this month
                  </div>
                )}
              </div>
            );
          })}

          {budgets.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No spending limits set yet.</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowAddBudget(true)}>Add First Budget</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Financial Goal Modal ───────────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Financial Goal</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Goal Name</label>
              <input className="form-input" placeholder="e.g., Emergency Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} id="goal-name" />
            </div>
            <div className="form-group">
              <label className="form-label">Target Amount (₹)</label>
              <input type="number" className="form-input" value={form.target_amount || ''} onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })} id="goal-target" />
            </div>
            <div className="form-group">
              <label className="form-label">Current Amount (₹)</label>
              <input type="number" className="form-input" value={form.current_amount || ''} onChange={(e) => setForm({ ...form, current_amount: Number(e.target.value) })} id="goal-current" />
            </div>
            <div className="form-group">
              <label className="form-label">Target Deadline</label>
              <input type="date" className="form-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Funding Channels (Source of Funds)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="e.g., Salary, Bonus, Rent"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (channelInput.trim()) {
                      setForm({ ...form, funding_channels: [...form.funding_channels, channelInput.trim()] });
                      setChannelInput('');
                    }
                  }}
                  type="button"
                >
                  Add
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {form.funding_channels.map((chan, i) => (
                  <span key={i} style={{ fontSize: '0.9rem', fontWeight: 600, padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {chan}
                    <button
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                      onClick={() => setForm({ ...form, funding_channels: form.funding_channels.filter((_, idx) => idx !== i) })}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={createGoal} id="confirm-create-goal">
              Create Goal
            </button>
          </div>
        </div>
      )}

      {/* ── Budget Modal ───────────────────────────────────────────────────────── */}
      {showAddBudget && (
        <div className="modal-overlay" onClick={() => setShowAddBudget(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Spending Limit</h3>
              <button className="modal-close" onClick={() => setShowAddBudget(false)}>✕</button>
            </div>
            <form onSubmit={handleSetBudget}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}>
                  <option value="General">General (Overall Spending)</option>
                  <option value="Food">Food & Dining</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Travel">Travel</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Limit (₹)</label>
                <input type="number" className="form-input" required value={budgetForm.amount_limit} onChange={e => setBudgetForm({ ...budgetForm, amount_limit: Number(e.target.value) })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                Enforce Limit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
