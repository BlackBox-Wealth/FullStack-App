import React, { useEffect, useState } from 'react';
import { investmentsAPI } from '../api';

const Goals: React.FC = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: 0, current_amount: 0, deadline: '' });

  useEffect(() => { loadGoals(); }, []);

  const loadGoals = async () => {
    try {
      const res = await investmentsAPI.getGoals();
      setGoals(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createGoal = async () => {
    try {
      await investmentsAPI.createGoal(form);
      setShowCreate(false);
      setForm({ name: '', target_amount: 0, current_amount: 0, deadline: '' });
      loadGoals();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Financial Goals</h2>
          <p>Track and achieve your financial dreams</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-goal-btn">
          + New Goal
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {goals.map((goal) => (
          <div key={goal.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{goal.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Target: {goal.deadline}</p>
              </div>
              <span className={`badge-status ${goal.status}`}>{goal.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                ₹{goal.current_amount.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ₹{goal.target_amount.toLocaleString()}
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(goal.progress_pct, 100)}%` }} />
            </div>
            <div style={{ textAlign: 'right', marginTop: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
              {goal.progress_pct.toFixed(1)}%
            </div>
          </div>
        ))}

        {goals.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="icon">🎯</div>
            <p>No financial goals yet. Create your first goal!</p>
          </div>
        )}
      </div>

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
              <label className="form-label">Target Date</label>
              <input type="date" className="form-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} id="goal-deadline" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={createGoal} id="confirm-create-goal">
              Create Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
