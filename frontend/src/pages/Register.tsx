import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { authAPI } from '../api';
import { useAuthStore } from '../store';

export default function Register(): React.JSX.Element {
  const [step, setStep] = useState<'form' | 'verify-email' | 'verify-phone'>('form');
  const [form, setForm] = useState({ 
    email: '', 
    password: '', 
    full_name: '', 
    phone: '' 
  });
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtpDebug, setEmailOtpDebug] = useState('');
  const [phoneOtpDebug, setPhoneOtpDebug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const emailRes = await authAPI.sendEmailOtpForRegistration(form.email);
      setEmailOtpDebug(emailRes.data.otp_debug || '');
      setStep('verify-email');
    } catch (err: unknown) {
      const error = err as AxiosError<{ detail: string }>;
      setError(error.response?.data?.detail || 'Failed to send email OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOtpVerify = async () => {
    setError('');
    setLoading(true);
    
    try {
      const phoneRes = await authAPI.sendPhoneOtpForRegistration(form.phone);
      setPhoneOtpDebug(phoneRes.data.otp_debug || '');
      setStep('verify-phone');
    } catch (err: unknown) {
      const error = err as AxiosError<{ detail: string }>;
      setError(error.response?.data?.detail || 'Failed to send phone OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtpVerify = async () => {
    setError('');
    setLoading(true);
    
    try {
      const res = await authAPI.completeRegistration({
        ...form,
        email_otp: emailOtp,
        phone_otp: phoneOtp,
      });
      login(res.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as AxiosError<{ detail: string }>;
      setError(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">W</div>
          <h1>WealthVault</h1>
          <p>
            {step === 'form' && 'Create your secure account'}
            {step === 'verify-email' && 'Verify your email'}
            {step === 'verify-phone' && 'Verify your phone'}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {step === 'form' && (
          <form onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                id="register-name"
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                id="register-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                id="register-phone"
                type="tel"
                className="form-input"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="register-password"
                type="password"
                className="form-input"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Sending OTP...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'verify-email' && (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
              We sent a 6-digit code to <strong>{form.email}</strong>
            </p>
            {emailOtpDebug && (
              <div style={{ padding: '10px 14px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                🔑 Debug OTP: <strong>{emailOtpDebug}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Enter Email OTP</label>
              <input
                id="email-otp-input"
                type="text"
                className="form-input"
                placeholder="6-digit code"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              />
            </div>
            <button
              id="verify-email-btn"
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleEmailOtpVerify}
              disabled={loading || emailOtp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </>
        )}

        {step === 'verify-phone' && (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
              We sent a 6-digit code to <strong>{form.phone}</strong>
            </p>
            {phoneOtpDebug && (
              <div style={{ padding: '10px 14px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                🔑 Debug OTP: <strong>{phoneOtpDebug}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Enter Phone OTP</label>
              <input
                id="phone-otp-input"
                type="text"
                className="form-input"
                placeholder="6-digit code"
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value)}
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              />
            </div>
            <button
              id="verify-phone-btn"
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handlePhoneOtpVerify}
              disabled={loading || phoneOtp.length !== 6}
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </>
        )}

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
