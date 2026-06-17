import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import portalApi from '../api';
import { trackPageEnter, trackPageLeave, trackClick } from '../tracker';

interface KYCRecord {
  user_id: string;
  full_name?: string;
  email?: string;
  kyc_status: string;
  submitted_at?: string;
  documents?: string[];
}

const AdminKYC: React.FC = () => {
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    trackPageEnter('/admin/kyc');
    return () => trackPageLeave('/admin/kyc');
  }, []);

  useEffect(() => {
    loadKYC();
  }, []);

  const loadKYC = () => {
    setLoading(true);
    portalApi
      .get('/api/v1/admin/kyc/pending')
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data?.records || [];
        setRecords(data.length ? data : FALLBACK_KYC);
      })
      .catch(() => setRecords(FALLBACK_KYC))
      .finally(() => setLoading(false));
  };

  const handleAction = async (userId: string, action: 'approved' | 'rejected') => {
    setActionLoading(userId + action);
    trackClick(`kyc_${action}`, { user_id: userId });
    try {
      await portalApi.put(`/api/v1/admin/kyc/${userId}/action`, { action });
      loadKYC();
    } catch {
      loadKYC();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>KYC Verification</h2>
          <p>Review and verify customer identity documents</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="badge-status pending">{records.length} Pending</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { trackClick('kyc_refresh'); loadKYC(); }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No pending KYC verifications
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Documents</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.user_id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rec.full_name || 'Unknown'}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{rec.email || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(rec.documents || ['Aadhaar', 'PAN']).map((d) => (
                          <span
                            key={d}
                            style={{
                              fontSize: '0.72rem',
                              background: 'var(--info-bg)',
                              color: 'var(--info)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {rec.submitted_at
                        ? new Date(rec.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge-status ${rec.kyc_status}`}>{rec.kyc_status}</span>
                    </td>
                    <td>
                      {(rec.kyc_status === 'pending' || rec.kyc_status === 'pending_review') && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success)', color: 'white' }}
                            disabled={actionLoading === rec.user_id + 'approved'}
                            onClick={() => handleAction(rec.user_id, 'approved')}
                          >
                            <ShieldCheck size={13} />
                            {actionLoading === rec.user_id + 'approved' ? '…' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={actionLoading === rec.user_id + 'rejected'}
                            onClick={() => handleAction(rec.user_id, 'rejected')}
                          >
                            <ShieldAlert size={13} />
                            {actionLoading === rec.user_id + 'rejected' ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const FALLBACK_KYC: KYCRecord[] = [
  { user_id: 'u001', full_name: 'Arjun Mehta', email: 'arjun.mehta@example.com', kyc_status: 'pending_review', documents: ['Aadhaar', 'PAN', 'Selfie'], submitted_at: '2025-05-27T10:30:00' },
  { user_id: 'u002', full_name: 'Priya Nair', email: 'priya.nair@example.com', kyc_status: 'pending', documents: ['Aadhaar', 'PAN'], submitted_at: '2025-05-26T14:15:00' },
  { user_id: 'u003', full_name: 'Suresh Pillai', email: 'suresh.p@example.com', kyc_status: 'pending', documents: ['Passport', 'PAN', 'Address Proof'], submitted_at: '2025-05-26T09:00:00' },
  { user_id: 'u004', full_name: 'Kavya Reddy', email: 'kavya.r@example.com', kyc_status: 'pending_review', documents: ['Aadhaar', 'Voter ID'], submitted_at: '2025-05-25T16:45:00' },
];

export default AdminKYC;
