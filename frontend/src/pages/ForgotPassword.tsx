import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await authAPI.requestPasswordReset(email);
      setMessage({ 
        type: 'success', 
        text: response.data.message || 'OTP sent to your recovery email/phone!' 
      });
      setStep('reset');
      
      // Show debug OTP in console
      if (response.data.otp_debug) {
        console.log('Password Reset OTP:', response.data.otp_debug);
      }
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      
      if (status === 429) {
        setMessage({ 
          type: 'error', 
          text: 'Too many requests. Please try again in an hour.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: detail || 'Failed to send reset code' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword({
        email,
        otp,
        new_password: newPassword,
      });
      
      setMessage({ 
        type: 'success', 
        text: 'Password reset successful! Redirecting to login...' 
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      
      setOtpAttempts(prev => prev + 1);
      
      if (status === 429) {
        setMessage({ 
          type: 'error', 
          text: 'Too many failed attempts. Please request a new OTP.' 
        });
        // Reset to request step after max attempts
        setTimeout(() => {
          setStep('request');
          setOtp('');
          setOtpAttempts(0);
        }, 3000);
      } else if (status === 400 && detail?.includes('Invalid or expired')) {
        setMessage({ 
          type: 'error', 
          text: `Invalid OTP. Attempt ${otpAttempts + 1}/3` 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: detail || 'Failed to reset password' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
        <h2 style={{ marginBottom: '8px' }}>Reset Password</h2>
        <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {step === 'request' 
            ? 'Enter your email to receive a password reset code' 
            : 'Enter the code sent to your recovery contacts'}
        </p>

        {step === 'request' ? (
          <form onSubmit={handleRequestReset}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
                autoFocus
              />
            </div>

            {message && (
              <div 
                style={{ 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  background: message.type === 'success' ? '#d4edda' : '#f8d7da',
                  color: message.type === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !email}
              style={{ width: '100%', marginBottom: '12px' }}
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <button 
              type="button"
              className="btn"
              onClick={() => navigate('/login')}
              style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div style={{ 
              padding: '12px', 
              background: '#e7f3ff', 
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #b3d9ff'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#004085' }}>
                Reset code sent to: <strong>{email}</strong>
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="otp">Reset Code (6 digits) {otpAttempts > 0 && `- Attempt ${otpAttempts}/3`}</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="form-input"
                maxLength={6}
                required
                autoFocus
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                minLength={8}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                minLength={8}
                required
              />
            </div>

            {message && (
              <div 
                style={{ 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  background: message.type === 'success' ? '#d4edda' : '#f8d7da',
                  color: message.type === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                {message.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn"
                onClick={() => {
                  setStep('request');
                  setOtp('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setMessage(null);
                }}
                style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                Back
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading || !otp || !newPassword || !confirmPassword}
                style={{ flex: 1 }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
