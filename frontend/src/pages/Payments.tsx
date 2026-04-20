import React, { useEffect, useState } from 'react';
import { paymentsAPI, accountsAPI } from '../api';

const Payments: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [form, setForm] = useState({ 
    from_account_id: '', 
    to_account_number: '', 
    amount: 0, 
    description: '',
    otp_channel: 'email'
  });
  const [paymentId, setPaymentId] = useState('');
  const [otp, setOtp] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    setLoadingAccounts(true);
    accountsAPI.getAll()
      .then((res) => {
        setAccounts(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("Failed to load accounts:", err);
        setError("Could not load your accounts. Please try again.");
      })
      .finally(() => setLoadingAccounts(false));
      
    paymentsAPI.getAll().then((res) => setPayments(res.data));
  }, []);

  const initiatePayment = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await paymentsAPI.initiate(form);
      setPaymentId(res.data.payment_id);
      setDebugOtp(res.data.otp_debug || '');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    setError('');
    setLoading(true);
    try {
      await paymentsAPI.verify(paymentId, otp);
      setStep('success');
      paymentsAPI.getAll().then((res) => setPayments(res.data));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('form');
    setForm({ 
      from_account_id: '', 
      to_account_number: '', 
      amount: 0, 
      description: '',
      otp_channel: 'email'
    });
    setOtp('');
    setError('');
    setPaymentId('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Payments</h2>
          <p>Send money securely with OTP verification</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Payment Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              {step === 'form' ? '💸 New Payment' : step === 'otp' ? '🔐 Verify OTP' : '✅ Payment Successful'}
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {step === 'form' && (
            <>
              <div className="form-group">
                <label className="form-label">From Account</label>
                {loadingAccounts ? (
                  <div className="form-input" style={{ color: 'var(--text-muted)' }}>Loading accounts...</div>
                ) : accounts.length === 0 ? (
                  <div className="auth-error" style={{ marginBottom: 0, background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                    No active accounts found. Please <a href="/accounts" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}>create an account</a> first.
                  </div>
                ) : (
                  <select className="form-select" value={form.from_account_id} onChange={(e) => setForm({ ...form, from_account_id: e.target.value })} id="payment-from-account">
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank_name || 'Bank'} - ••{a.account_number?.toString().slice(-4) || 'XXXX'} (₹{a.balance?.toLocaleString() || '0'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">To Account Number</label>
                <input className="form-input" placeholder="Enter recipient account number" value={form.to_account_number} onChange={(e) => setForm({ ...form, to_account_number: e.target.value })} id="payment-to-account" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" className="form-input" placeholder="0.00" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} id="payment-amount" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Payment note (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} id="payment-description" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Verification Mode</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="otp_channel" value="email" checked={form.otp_channel === 'email'} onChange={(e) => setForm({ ...form, otp_channel: e.target.value })} />
                    Email
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="otp_channel" value="sms" checked={form.otp_channel === 'sms'} onChange={(e) => setForm({ ...form, otp_channel: e.target.value })} />
                    SMS
                  </label>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={initiatePayment} disabled={loading || !form.from_account_id || !form.to_account_number || !form.amount} id="initiate-payment-btn">
                {loading ? 'Processing...' : 'Send Payment'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
                An OTP has been sent to your registered phone number. Please enter it below.
              </p>
              {debugOtp && (
                <div style={{ padding: '10px 14px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                  🔑 Debug OTP: <strong>{debugOtp}</strong>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Enter OTP</label>
                <input className="form-input" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }} id="otp-input" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={verifyPayment} disabled={loading || otp.length !== 6} id="verify-otp-btn">
                {loading ? 'Verifying...' : 'Verify & Complete'}
              </button>
            </>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h3 style={{ marginBottom: 8 }}>Payment Completed!</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                ₹{form.amount.toLocaleString()} has been sent successfully.
              </p>
              <button className="btn btn-primary" onClick={reset} id="new-payment-btn">Make Another Payment</button>
            </div>
          )}
        </div>

        {/* Payment History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Payment History</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: '0.8rem' }}>
                      {new Date(p.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>₹{p.amount?.toLocaleString()}</td>
                    <td><span className={`badge-status ${p.status}`}>{p.status}</span></td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><p>No payments yet</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
