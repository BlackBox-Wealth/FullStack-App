import React, { useState } from 'react';
import { aaAPI, accountsAPI } from '../api';
import { Skeleton } from 'boneyard-js/react';

const AccountAggregator: React.FC = () => {
  const [step, setStep] = useState(1); // 1: Intro, 2: Consent, 3: Success/Fetch
  const [loading, setLoading] = useState(false);
  const [externalAccounts, setExternalAccounts] = useState<any[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const handleStartConsent = async () => {
    setLoading(true);
    try {
      await aaAPI.requestConsent();
      setStep(2);
      // Simulate AA approval process
      setTimeout(() => {
        setStep(3);
        fetchExternalAccounts();
      }, 2000);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchExternalAccounts = async () => {
    setLoading(true);
    try {
      const res = await aaAPI.getAccounts();
      setExternalAccounts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAccounts(newSelected);
  };

  const linkSelected = async () => {
    setLoading(true);
    try {
      for (const id of selectedAccounts) {
        const acc = externalAccounts.find(a => a.id === id);
        if (acc) {
          await accountsAPI.linkExternal({
            bank_name: acc.bank_name,
            account_number: acc.account_number,
            ifsc_code: 'LINK0001234',
            account_holder_name: acc.holder_name,
            balance: acc.balance,
          });
        }
      }
      window.location.href = '/accounts';
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aa-container" style={{ maxWidth: 800, margin: '20px auto' }}>
      <div className="page-header">
        <div>
          <h2>Account Aggregator (NBFC-AA)</h2>
          <p>Securely link your accounts from other banks</p>
        </div>
      </div>

      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        {step === 1 && (
          <div>
            <div style={{ fontSize: '4rem', marginBottom: 20 }}>🔗</div>
            <h3>Connect via Account Aggregator</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>
              WealthVault uses the Account Aggregator framework to safely access your financial data 
              from other banks with your explicit consent. No more sharing PDF statements!
            </p>
            <div className="stat-grid" style={{ marginBottom: 30, textAlign: 'left' }}>
              <div className="stat-card" style={{ padding: '15px' }}>
                <div style={{ fontWeight: 'bold' }}>✓ RBI Regulated</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Secure and standardized data sharing</div>
              </div>
              <div className="stat-card" style={{ padding: '15px' }}>
                <div style={{ fontWeight: 'bold' }}>✓ Privacy First</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You control who sees what and for how long</div>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={handleStartConsent} disabled={loading}>
              {loading ? 'Initiating...' : 'Get Started'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '40px 0' }}>
            <Skeleton
              name="account-aggregator-consent"
              loading
              animate="shimmer"
              fallback={
                <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
                  <div style={{ height: 16, width: '48%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
                  <div style={{ height: 12, width: '62%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
                  <div style={{ height: 12, width: '56%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
                </div>
              }
            >
              <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
                <div style={{ height: 16, width: '48%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
                <div style={{ height: 12, width: '62%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
                <div style={{ height: 12, width: '56%', margin: '0 auto', borderRadius: 8, background: 'var(--bg-secondary)' }} />
              </div>
            </Skeleton>
            <h3>Waiting for Consent Approval</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Please approve the consent request on your AA handle (e.g., PSD@onemoney)
            </p>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>Select accounts to link</h3>
              <button className="btn btn-primary" onClick={linkSelected} disabled={selectedAccounts.size === 0 || loading}>
                {loading ? 'Linking...' : `Link ${selectedAccounts.size} Accounts`}
              </button>
            </div>
            
            {loading ? (
              <p>Fetching your accounts...</p>
            ) : (
              <div style={{ display: 'grid', gap: 15 }}>
                {externalAccounts.map(acc => (
                  <div 
                    key={acc.id} 
                    className={`account-card ${selectedAccounts.has(acc.id) ? 'selected' : ''}`}
                    onClick={() => toggleAccount(acc.id)}
                    style={{ 
                      cursor: 'pointer', 
                      border: selectedAccounts.has(acc.id) ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div className="bank-name">{acc.bank_name}</div>
                        <div className="account-number">•••• {acc.account_number.slice(-4)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="balance">₹{acc.balance.toLocaleString('en-IN')}</div>
                        <div className="account-type">{acc.account_type}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountAggregator;
