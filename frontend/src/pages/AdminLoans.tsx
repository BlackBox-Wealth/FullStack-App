import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import PageLoader from '../components/animation/PageLoader';

const AdminLoans: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadLoans(); }, [filter]);

  const loadLoans = async () => {
    try {
      const res = await adminAPI.getAllLoans(filter || undefined);
      setLoans(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApprove = async (loanId: string) => {
    await adminAPI.approveLoan(loanId);
    loadLoans();
  };

  const handleReject = async (loanId: string) => {
    await adminAPI.rejectLoan(loanId);
    loadLoans();
  };

  if (loading) return <PageLoader label="Loading loans" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Loan Management</h2>
          <p>Review and manage loan applications</p>
        </div>
        <select className="form-select" style={{ width: 180 }} value={filter} onChange={(e) => setFilter(e.target.value)} id="loan-status-filter">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card">
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
              {loans.map((loan: any) => (
                <tr key={loan.id}>
                  <td style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary)' }}>{loan.loan_type}</td>
                  <td style={{ fontFamily: 'monospace' }}>₹{loan.amount?.toLocaleString()}</td>
                  <td>{loan.tenure_months} mo</td>
                  <td>{loan.interest_rate}%</td>
                  <td style={{ fontWeight: 600 }}>₹{loan.emi?.toLocaleString()}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loan.purpose}</td>
                  <td><span className={`badge-status ${loan.status}`}>{loan.status}</span></td>
                  <td>
                    {loan.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-success" onClick={() => handleApprove(loan.id)}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleReject(loan.id)}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><p>No loans found</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLoans;
