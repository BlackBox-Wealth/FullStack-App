import React, { useEffect, useState } from 'react';
import { accountsAPI, mlAPI } from '../api';
import KYCGuard from '../components/KYCGuard';
import { Lightbulb } from 'lucide-react';
import PageInfoButton from '../components/PageInfoButton';
import { useTranslation } from '../hooks/useTranslation';
import PageLoader from '../components/animation/PageLoader';

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [visibleAccounts, setVisibleAccounts] = useState<Set<string>>(new Set());
  const [accountToDelete, setAccountToDelete] = useState<any | null>(null);
  const [form, setForm] = useState({ account_number: '', account_type: 'savings', bank_name: 'WealthVault Bank', initial_deposit: 0 });
  const [llmNudge, setLlmNudge] = useState<string | null>(null);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const [res, insightRes] = await Promise.all([
        accountsAPI.getAll(),
        mlAPI.accountInsights().catch(() => null)
      ]);
      setAccounts(res.data);
      if (insightRes?.data?.llm_nudge) setLlmNudge(insightRes.data.llm_nudge);
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
      setForm({ account_number: '', account_type: 'savings', bank_name: 'WealthVault Bank', initial_deposit: 0 });
      loadAccounts();
    } catch (err) { console.error(err); }
  };

  const deleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      await accountsAPI.delete(accountToDelete.id);
      setAccountToDelete(null);
      loadAccounts();
    } catch (err) { console.error(err); }
  };

  if (loading) return <PageLoader label="Loading accounts" />;

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <KYCGuard>
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
            {t('accounts.title')}
            <PageInfoButton
              pageTitle={t('accounts.title')}
              items={[
                { title: 'Account Aggregator (AA)', description: 'Securely link all your other bank accounts from different banks to track your finances in one single dashboard.' },
                { title: 'Private Balances', description: 'Your balances and account details are homomorphically encrypted to ensure tracking and privacy security.' },
                { title: 'Account Types', description: 'Different account categories like Savings, Current, and External accounts to organize your finances.' }
              ]}
            />
          </h2>
          <p>{t('accounts.manage')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-account-btn">
            {t('accounts.newAccount')}
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/account-aggregator'}>
            {t('accounts.linkBanks')}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon purple">INR</div>
          <div className="stat-value">₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className="stat-label">{t('accounts.totalBalance')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">ACC</div>
          <div className="stat-value">{accounts.filter(a => !a.is_external).length}</div>
          <div className="stat-label">{t('accounts.wvAccounts')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">EXT</div>
          <div className="stat-value">{accounts.filter(a => a.is_external).length}</div>
          <div className="stat-label">{t('accounts.linkedExternal')}</div>
        </div>
      </div>

      {llmNudge && (
        <div style={{ marginBottom: 24, padding: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <Lightbulb size={20} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--accent-secondary)' }} />
          <span style={{ lineHeight: 1.5, width: '100%', fontWeight: 500 }}>{llmNudge}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {accounts.map((acc) => (
          <div key={acc.id} className="account-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="bank-name">{acc.bank_name}</div>
                <div className="account-number" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {visibleAccounts.has(acc.id) ? acc.account_number.split('').reverse().join('').replace(/(.{4})/g, '$1 ').split('').reverse().join('') : `•••• •••• ${acc.account_number.slice(-4)}`}
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
                    {visibleAccounts.has(acc.id) ? t('common.hide') : t('common.show')}
                  </button>
                </div>
              </div>
              <span className={`badge-status ${acc.status}`}>{acc.status}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setAccountToDelete(acc); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                  marginLeft: '10px'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                title="Remove Account"
              >
                ✕
              </button>
            </div>
            <div className="balance">₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="account-type">{t(`accounts.types.${acc.account_type}`)}</span>
              {acc.is_external && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('accounts.external')}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Create Account Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('accounts.createAccount')}</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your bank account number"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })}
                maxLength={18}
                id="account-number-input"
              />
              {form.account_number.length > 0 && form.account_number.length < 8 && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
                  Account number must be at least 8 digits
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{t('accounts.accountType')}</label>
              <select className="form-select" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} id="account-type-select">
                <option value="savings">{t('accounts.types.savings')}</option>
                <option value="current">{t('accounts.types.current')}</option>
                <option value="fixed_deposit">{t('accounts.types.fixed_deposit')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('accounts.initialDeposit')}</label>
              <input type="number" className="form-input" min={10000} value={form.initial_deposit} onChange={(e) => setForm({ ...form, initial_deposit: Number(e.target.value) })} id="initial-deposit-input" />
              {form.initial_deposit < 10000 && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
                  Minimum initial deposit is ₹10,000
                </p>
              )}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={createAccount} id="confirm-create-account" disabled={form.initial_deposit < 10000 || form.account_number.length < 8}>
              {t('accounts.createAccount')}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="modal-overlay" onClick={() => setAccountToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>{t('accounts.removeConfirm')}</h3>
              <button className="modal-close" onClick={() => setAccountToDelete(null)}>✕</button>
            </div>
            <p style={{ marginBottom: 24, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Are you sure you want to remove <strong>{accountToDelete.bank_name} (***{accountToDelete.account_number.slice(-4)})</strong> from WealthVault? 
              {t('accounts.removeWarning')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAccountToDelete(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={deleteAccount}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </KYCGuard>
  );
};

export default Accounts;
