import React, { useEffect, useState } from 'react';
import { loansAPI } from '../api';

const Loans: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ loan_type: 'personal', amount: 0, tenure_months: 12, purpose: '' });

  useEffect(() => { loadLoans(); }, []);

  const loadLoans = async () => {
    try {
      const res = await loansAPI.getAll();
      setLoans(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const applyLoan = async () => {
    try {
      await loansAPI.apply(form);
      setShowApply(false);
      loadLoans();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Loans</h2>
          <p>Apply for loans and track your applications</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowApply(true)} id="apply-loan-btn">
          + Apply for Loan
        </button>
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
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary)' }}>{loan.loan_type}</td>
                  <td style={{ fontFamily: 'monospace' }}>₹{loan.amount.toLocaleString()}</td>
                  <td>{loan.tenure_months} months</td>
                  <td>{loan.interest_rate}%</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>₹{loan.emi.toLocaleString()}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loan.purpose}</td>
                  <td><span className={`badge-status ${loan.status}`}>{loan.status}</span></td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><p>No loans yet</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showApply && (
        <div className="modal-overlay" onClick={() => setShowApply(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply for Loan</h3>
              <button className="modal-close" onClick={() => setShowApply(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Loan Type</label>
              <select className="form-select" value={form.loan_type} onChange={(e) => setForm({ ...form, loan_type: e.target.value })} id="loan-type">
                <option value="personal">Personal</option>
                <option value="home">Home</option>
                <option value="vehicle">Vehicle</option>
                <option value="education">Education</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Loan Amount (₹)</label>
              <input type="number" className="form-input" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} id="loan-amount" />
            </div>
            <div className="form-group">
              <label className="form-label">Tenure (Months)</label>
              <select className="form-select" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: Number(e.target.value) })} id="loan-tenure">
                {[12, 24, 36, 60, 120, 180, 240, 360].map((t) => (
                  <option key={t} value={t}>{t} months ({(t / 12).toFixed(0)} years)</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Purpose</label>
              <input className="form-input" placeholder="Describe the purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} id="loan-purpose" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={applyLoan} id="submit-loan-btn">
              Submit Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
