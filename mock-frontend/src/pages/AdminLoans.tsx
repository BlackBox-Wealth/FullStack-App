import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import portalApi from '../api';
import { trackPageEnter, trackPageLeave, trackClick } from '../tracker';

interface Loan {
  id: string;
  loan_type: string;
  amount: number;
  tenure_months: number;
  interest_rate: number;
  emi: number;
  purpose: string;
  status: string;
  created_at?: string;
}

const AdminLoans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    trackPageEnter('/admin/loans');
    return () => trackPageLeave('/admin/loans');
  }, []);

  useEffect(() => {
    loadLoans();
  }, [filter]);

  const loadLoans = () => {
    setLoading(true);
    portalApi
      .get('/api/v1/admin/loans', { params: filter ? { status: filter } : {} })
      .then((r) => setLoans(Array.isArray(r.data) ? r.data : r.data?.loans || []))
      .catch(() => setLoans(FALLBACK_LOANS))
      .finally(() => setLoading(false));
  };

  const handleAction = async (loanId: string, action: 'approve' | 'reject') => {
    setActionLoading(loanId + action);
    trackClick(`loan_${action}`, { loan_id: loanId });
    try {
      if (action === 'approve') {
        await portalApi.put(`/api/v1/admin/loans/${loanId}/approve`);
      } else {
        await portalApi.put(`/api/v1/admin/loans/${loanId}/reject`);
      }
      loadLoans();
    } catch {
      loadLoans();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Loan Management</h2>
          <p>Review and manage loan applications</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 180 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { trackClick('loans_refresh'); loadLoans(); }}
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
        ) : loans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No loan applications found
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Tenure</th>
                  <th>Rate</th>
                  <th>EMI</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {loan.loan_type?.replace(/_/g, ' ')}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>₹{loan.amount?.toLocaleString()}</td>
                    <td>{loan.tenure_months} mo</td>
                    <td>{loan.interest_rate}%</td>
                    <td style={{ fontWeight: 600 }}>₹{loan.emi?.toLocaleString()}</td>
                    <td
                      style={{
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loan.purpose}
                    </td>
                    <td>
                      <span className={`badge-status ${loan.status}`}>{loan.status}</span>
                    </td>
                    <td>
                      {loan.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success)', color: 'white' }}
                            disabled={actionLoading === loan.id + 'approve'}
                            onClick={() => handleAction(loan.id, 'approve')}
                          >
                            {actionLoading === loan.id + 'approve' ? '…' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={actionLoading === loan.id + 'reject'}
                            onClick={() => handleAction(loan.id, 'reject')}
                          >
                            {actionLoading === loan.id + 'reject' ? '…' : 'Reject'}
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

const FALLBACK_LOANS: Loan[] = [
  { id: 'loan-001', loan_type: 'home_loan', amount: 2500000, tenure_months: 240, interest_rate: 8.5, emi: 21743, purpose: 'Purchase of residential property in Sector 12, Dwarka', status: 'pending' },
  { id: 'loan-002', loan_type: 'personal_loan', amount: 500000, tenure_months: 48, interest_rate: 13.5, emi: 13561, purpose: 'Medical emergency expenses', status: 'pending' },
  { id: 'loan-003', loan_type: 'education_loan', amount: 1200000, tenure_months: 120, interest_rate: 9.5, emi: 15529, purpose: 'MBA programme at IIM Bangalore', status: 'approved' },
  { id: 'loan-004', loan_type: 'vehicle_loan', amount: 800000, tenure_months: 60, interest_rate: 10.5, emi: 17180, purpose: 'Purchase of four-wheeler', status: 'approved' },
  { id: 'loan-005', loan_type: 'business_loan', amount: 3000000, tenure_months: 84, interest_rate: 12.0, emi: 52000, purpose: 'Working capital for retail business expansion', status: 'rejected' },
];

export default AdminLoans;
