import React, { useEffect, useState } from 'react';
import { budgetsAPI } from '../api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FiTarget, FiAlertCircle, FiSettings, FiPlus } from 'react-icons/fi';
import PageInfoButton from '../components/PageInfoButton';
import PageLoader from '../components/animation/PageLoader';

const Budgets: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: 'General', amount_limit: 1000 });

  useEffect(() => { loadBudgets(); }, []);

  const loadBudgets = async () => {
    try {
      const res = await budgetsAPI.getAll();
      setBudgets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await budgetsAPI.create(form);
      setShowAdd(false);
      toast.success(`Budget set for ${form.category}`);
      loadBudgets();
    } catch (err) { toast.error('Failed to set budget'); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'exceeded': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  if (loading) return <PageLoader label="Loading budgets" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="budgets-page">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
            Healthy Habits: Spending Limits
            <PageInfoButton
              pageTitle="Budgets"
              items={[
                { title: 'Budget Categories', description: 'Organize your spending limits across different categories like Food, Travel, Entertainment, Shopping, and more.' },
                { title: 'Spending Health', description: 'Visual indicators showing Healthy (green), Warning (yellow), or Exceeded (red) status for each budget.' },
                { title: 'Monthly Limits', description: 'Set maximum spending amounts for each category to control expenses and track your financial goals.' }
              ]}
            />
          </h2>
          <p>Control your expenses and save more for your goals</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <FiPlus /> Set New Limit
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
        {budgets.map((b) => (
          <div key={b.id} className="card budget-card" style={{ borderLeft: `4px solid ${getStatusColor(b.status)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'capitalize' }}>{b.category}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly Limit: ₹{b.amount_limit}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: getStatusColor(b.status) }}>
                  ₹{b.current_spent}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent so far</p>
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
          </div>
        ))}

        {budgets.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            <FiSettings size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
            <h3>No Spending Limits Set</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '8px auto 24px' }}>
              Setting category-based limits helps you stay disciplined and reach your financial goals faster.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Set Your First Limit</button>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Spending Limit</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleSetBudget}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
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
                <input type="number" className="form-input" required value={form.amount_limit} onChange={e => setForm({...form, amount_limit: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                Enforce Limit
              </button>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Budgets;
