import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';

const AdminKYC: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPending(); }, []);

  const loadPending = async () => {
    try {
      const res = await adminAPI.getPendingKYC();
      setPendingUsers(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleVerify = async (userId: string, status: string) => {
    await adminAPI.verifyKYC(userId, status);
    loadPending();
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>KYC Verification</h2>
          <p>{pendingUsers.length} pending verifications</p>
        </div>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">✅</div>
            <p>All KYC verifications are up to date!</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {pendingUsers.map((u) => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--warning-bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', color: 'var(--warning)'
                }}>
                  ⏳
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email} · {u.phone}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-success" onClick={() => handleVerify(u.id, 'verified')}>✅ Verify</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleVerify(u.id, 'rejected')}>✕ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminKYC;
