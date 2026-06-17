import React, { useEffect, useState } from 'react';
import { paymentsAPI, accountsAPI } from '../api';
import KYCGuard from '../components/KYCGuard';
import { toast } from 'react-hot-toast';
import PageInfoButton from '../components/PageInfoButton';
import { useTranslation } from '../hooks/useTranslation';

const getPaymentErrorMessage = (err: unknown, fallback: string): string => {
  const error = err as {
    response?: { data?: { detail?: unknown; message?: unknown } };
    message?: unknown;
  };

  const detail = error.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          const msg = (item as { msg?: unknown }).msg;
          return typeof msg === 'string' ? msg : '';
        }
        return '';
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  const responseMessage = error.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const Payments: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [step, setStep] = useState<'form' | 'otp' | 'success' | 'pending_approval'>('form');
  const [paymentMode, setPaymentMode] = useState<'account' | 'upi'>('account');
  const [form, setForm] = useState({ 
    from_account_id: '', 
    to_account_number: '', 
    to_vpa: '',
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
  const [showInfo, setShowInfo] = useState(false);
  
  // QR State
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  
  // OTP Resend & Timer State
  const [resendCount, setResendCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

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

  useEffect(() => {
    let timer: any;
    if (step === 'otp' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const initiatePayment = async () => {
    setError('');

    const fromAccountId = form.from_account_id.trim();
    const toAccountNumber = form.to_account_number.trim();
    const toVpa = form.to_vpa.trim();
    const amount = Number(form.amount);

    if (!fromAccountId) {
      setError('Please select a source account');
      return;
    }

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (paymentMode === 'account' && !toAccountNumber) {
      setError('Please enter recipient account number');
      return;
    }

    if (paymentMode === 'upi' && !toVpa) {
      setError('Please enter recipient UPI ID');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        from_account_id: fromAccountId,
        amount,
        description: form.description,
        otp_channel: form.otp_channel
      };
      
      if (paymentMode === 'upi') {
        payload.to_vpa = toVpa;
      } else {
        payload.to_account_number = toAccountNumber;
      }
      
      const res = await paymentsAPI.initiate(payload);
      setPaymentId(res.data.payment_id);
      setDebugOtp(res.data.otp_debug || '');
      setStep('otp');
      setResendCount(0);
      setTimeLeft(60);
    } catch (err: unknown) {
      setError(getPaymentErrorMessage(err, 'Payment failed'));
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async () => {
    if (!form.amount || form.amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setQrLoading(true);
    setError('');
    try {
      const res = await paymentsAPI.generateQR(form.amount, form.description);
      setQrData(res.data);
      setShowQR(true);
    } catch (err: unknown) {
      setError(getPaymentErrorMessage(err, 'Failed to generate QR'));
    } finally {
      setQrLoading(false);
    }
  };

  const simulateScanQR = () => {
    // Simulate scanning a QR code
    const mockVPA = 'merchant@wealthvault';
    const mockAmount = 500;
    setPaymentMode('upi');
    setForm({ ...form, to_vpa: mockVPA, amount: mockAmount, description: 'Scanned QR Payment' });
    setShowQR(false);
    toast.success('QR Code scanned! Details auto-filled.');
  };

  const resendOTP = async () => {
    if (resendCount >= 3) return;
    setError('');
    setLoading(true);
    try {
      const res = await paymentsAPI.resendOTP(paymentId, form.otp_channel);
      setDebugOtp(res.data.otp_debug || '');
      setResendCount((prev) => prev + 1);
      setTimeLeft(60); // Reset timer
    } catch (err: unknown) {
      setError(getPaymentErrorMessage(err, 'Failed to resend OTP'));
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await paymentsAPI.verify(paymentId, otp);
      if (res.data.requires_app_approval) {
        setStep('pending_approval');
        paymentsAPI.getAll().then((res) => setPayments(res.data));
      } else {
        if (res.data.budget_alert) {
          toast(res.data.budget_alert, { icon: '⚠️', duration: 6000 });
        }
        setStep('success');
        paymentsAPI.getAll().then((res) => setPayments(res.data));
      }
    } catch (err: unknown) {
      setError(getPaymentErrorMessage(err, 'OTP verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const refreshApprovalStatus = async () => {
    try {
      const res = await paymentsAPI.getAll();
      setPayments(res.data);
      const updated = (res.data as { id: string; status: string }[]).find((p) => p.id === paymentId);
      if (updated?.status === 'completed') {
        setStep('success');
        toast.success('Payment approved!');
      } else if (updated?.status === 'blocked') {
        reset();
        toast('Payment was rejected.', { icon: '🚫', duration: 4000 });
      }
    } catch {
      toast.error('Failed to refresh status');
    }
  };

  const reset = () => {
    setStep('form');
    setForm({ 
      from_account_id: '', 
      to_account_number: '', 
      to_vpa: '',
      amount: 0, 
      description: '',
      otp_channel: 'email'
    });
    setOtp('');
    setError('');
    setPaymentId('');
    setPaymentMode('account');
    setShowQR(false);
    setQrData(null);
  };

  return (
    <KYCGuard>
      <div>
        <div className="page-header">
          <div>
            <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
              {t('payments.title')}
              <PageInfoButton
                pageTitle={t('payments.title')}
                items={[
                  { title: 'Account Verification', description: 'All transfers require strict validation against your KYC status to prevent fraudulent account targeting.' },
                  { title: 'Multi-Factor OTP', description: 'Your funds are protected by a cooldown-gated OTP verification step sent dynamically to your registered device.' },
                  { title: 'Payment Modes', description: 'Send money via Account Number transfer or UPI ID with full encryption and security.' }
                ]}
              />
            </h2>
            <p>Send money securely with OTP verification</p>
          </div>
        </div>

        <div className="grid-2">
          {/* Payment Form */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                {step === 'form' ? t('payments.newPayment') : step === 'otp' ? t('payments.verifyOtp') : step === 'pending_approval' ? 'Awaiting Mobile Approval' : t('payments.success')}
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            {step === 'form' && (
              <>
                {/* Payment Mode Toggle */}
                <div className="form-group">
                  <label className="form-label">{t('payments.mode')}</label>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button
                      type="button"
                      className={`btn ${paymentMode === 'account' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setPaymentMode('account')}
                    >
                      {t('payments.accountNumber')}
                    </button>
                    <button
                      type="button"
                      className={`btn ${paymentMode === 'upi' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setPaymentMode('upi')}
                    >
                      {t('payments.upiId')}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('payments.fromAccount')}</label>
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

                {/* Conditional Destination Field */}
                {paymentMode === 'account' ? (
                  <div className="form-group">
                    <label className="form-label">{t('payments.toAccount')}</label>
                    <input 
                      className="form-input" 
                      placeholder="Enter recipient account number" 
                      value={form.to_account_number} 
                      onChange={(e) => setForm({ ...form, to_account_number: e.target.value })} 
                      id="payment-to-account" 
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">{t('payments.toUpi')}</label>
                    <input 
                      className="form-input" 
                      placeholder="user@wealthvault" 
                      value={form.to_vpa} 
                      onChange={(e) => setForm({ ...form, to_vpa: e.target.value })} 
                      id="payment-to-vpa"
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Example: john@wealthvault
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">{t('common.amount')} (₹)</label>
                  <input type="number" className="form-input" placeholder="0.00" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} id="payment-amount" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.description')}</label>
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

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginBottom: 12 }} 
                  onClick={initiatePayment} 
                  disabled={
                    loading ||
                    !form.from_account_id.trim() ||
                    !form.amount ||
                    form.amount <= 0 ||
                    (paymentMode === 'account' && !form.to_account_number.trim()) ||
                    (paymentMode === 'upi' && !form.to_vpa.trim())
                  }
                  id="initiate-payment-btn"
                >
                  {loading ? t('common.processing') : t('payments.newPayment')}
                </button>

                {/* QR Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }} 
                    onClick={generateQR}
                    disabled={qrLoading}
                  >
                    {qrLoading ? 'Generating...' : '📱 Generate QR'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }} 
                    onClick={simulateScanQR}
                  >
                    🔍 Scan QR (Demo)
                  </button>
                </div>
              </>
            )}

            {step === 'otp' && (
              <>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem', lineHeight: '1.4' }}>
                  {form.otp_channel === 'email' 
                    ? 'An OTP has been sent to your registered email id. Please enter it below to authorize the transaction.' 
                    : 'An OTP has been sent to your registered phone number. Please enter it below to authorize the transaction.'}
                </p>
                {debugOtp && (
                  <div style={{ padding: '10px 14px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                    Debug OTP: <strong>{debugOtp}</strong>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Enter OTP</label>
                  <input className="form-input" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }} id="otp-input" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    onClick={resendOTP}
                    disabled={timeLeft > 0 || resendCount >= 3 || loading}
                  >
                    {resendCount >= 3 ? 'Max tries reached' : timeLeft > 0 ? `Resend OTP (${timeLeft}s)` : 'Resend OTP'}
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Attempts: {resendCount}/3
                  </span>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={verifyPayment} disabled={loading || otp.length !== 6} id="verify-otp-btn">
                  {loading ? 'Verifying...' : 'Verify & Complete'}
                </button>
              </>
            )}

            {step === 'pending_approval' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📱</div>
                <h3 style={{ marginBottom: 8 }}>Waiting for Mobile Approval</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.9rem', lineHeight: 1.6 }}>
                  This payment of <strong>₹{form.amount.toLocaleString()}</strong> exceeds ₹1,00,000.
                  A push notification has been sent to your mobile app.
                </p>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.85rem' }}>
                  Open your WealthVault mobile app and tap <strong>Approve</strong> or <strong>Reject</strong>,
                  then click Refresh below to see the updated status.
                </p>
                <button className="btn btn-primary" onClick={refreshApprovalStatus} id="refresh-approval-btn">
                  🔄 Refresh Status
                </button>
              </div>
            )}

            {step === 'success' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 16, fontWeight: 700 }}>Success</div>
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
              <div className="card-title">{t('payments.history')}</div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('payments.date')}</th>
                    <th>{t('common.amount')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 10).map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>₹{p.amount?.toLocaleString()}</td>
                      <td>
                        <span className={`badge-status ${p.status === 'pending_app_approval' ? 'flagged' : p.status}`}>
                          {p.status === 'pending_app_approval' ? '⏳ Pending Approval' : p.status}
                        </span>
                      </td>
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

        {/* QR Code Modal */}
        {showQR && qrData && (
          <div className="modal-overlay" onClick={() => setShowQR(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3>Payment QR Code</h3>
                <button className="modal-close" onClick={() => setShowQR(false)}>✕</button>
              </div>
              
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {/* Simple QR representation */}
                <div style={{
                  width: 200,
                  height: 200,
                  margin: '0 auto 20px',
                  background: 'white',
                  border: '2px solid var(--border-color)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem'
                }}>
                  📱
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>UPI ID</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>{qrData.vpa}</div>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Amount</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{qrData.amount.toLocaleString()}</div>
                </div>
                
                {qrData.description && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
                    <div style={{ fontSize: '0.9rem' }}>{qrData.description}</div>
                  </div>
                )}
                
                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace'
                }}>
                  {qrData.qr_data}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </KYCGuard>
  );
};

export default Payments;
