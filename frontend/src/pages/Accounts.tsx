import React, { useEffect, useState } from 'react';
import { accountsAPI } from '../api';

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [visibleAccounts, setVisibleAccounts] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ account_type: 'savings', bank_name: 'WealthVault Bank', initial_deposit: 0 });

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const res = await accountsAPI.getAll();
      setAccounts(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleVisibility = (id: string) => {
    const newVisible = new Set(visibleAccounts);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleAccounts(newVisible);
  };

  const createAccount = async () => {
    try {
      await accountsAPI.create(form);
      setShowCreate(false);
      setForm({ account_type: 'savings', bank_name: 'WealthVault Bank', initial_deposit: 0 });
      loadAccounts();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Accounts</h2>
          <p>Manage your bank accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-account-btn">
          + New Account
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon purple">💰</div>
          <div className="stat-value">₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className="stat-label">Total Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🏦</div>
          <div className="stat-value">{accounts.filter(a => !a.is_external).length}</div>
          <div className="stat-label">WealthVault Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🔗</div>
          <div className="stat-value">{accounts.filter(a => a.is_external).length}</div>
          <div className="stat-label">Linked External</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {accounts.map((acc) => (
          <div key={acc.id} className="account-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="bank-name">{acc.bank_name}</div>
                <div className="account-number" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {visibleAccounts.has(acc.id) ? acc.account_number : `•••• •••• ${acc.account_number.slice(-4)}`}
                  </span>
                  <button 
                    onClick={() => toggleVisibility(acc.id)} 
                    style={{ 
                      background: 'rgba(99, 102, 241, 0.1)', 
                      border: '1px solid rgba(99, 102, 241, 0.2)', 
                      borderRadius: '6px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--accent-primary)',
                      transition: 'all 0.2s'
                    }}
                    title={visibleAccounts.has(acc.id) ? "Hide Details" : "Show Details"}
                  >
                    {visibleAccounts.has(acc.id) ? '🔒' : '👁️'}
                  </button>
                </div>
              </div>
              <span className={`badge-status ${acc.status}`}>{acc.status}</span>
            </div>
            <div className="balance">₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="account-type">{acc.account_type}</span>
              {acc.is_external && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>External</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Create Account Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Account</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Account Type</label>
              <select className="form-select" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} id="account-type-select">
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="fixed_deposit">Fixed Deposit</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Initial Deposit (₹)</label>
              <input type="number" className="form-input" value={form.initial_deposit} onChange={(e) => setForm({ ...form, initial_deposit: Number(e.target.value) })} id="initial-deposit-input" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={createAccount} id="confirm-create-account">
              Create Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
