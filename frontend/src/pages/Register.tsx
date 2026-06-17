import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { authAPI, mlAPI } from '../api';
import { useAuthStore } from '../store';
import { useBiometrics } from '../hooks/useBiometrics';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import TurnstileWidget, { type TurnstileWidgetRef } from '../components/TurnstileWidget';
import logo from '../assets/wealth_vault_logo.png';

export default function Register(): React.JSX.Element {
  const [step, setStep] = useState<'form' | 'verify-email' | 'verify-phone' | 'terms'>('form');
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtpDebug, setEmailOtpDebug] = useState('');
  const [phoneOtpDebug, setPhoneOtpDebug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, isRehydrating } = useAuthStore();
  const captchaRef = useRef<TurnstileWidgetRef>(null);

  React.useEffect(() => {
    if (isAuthenticated && !isRehydrating) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isRehydrating, navigate]);

  const getApiErrorMessage = (err: unknown, fallback: string): string => {
    const axiosErr = err as AxiosError<{ detail?: unknown }>;
    const detail = axiosErr.response?.data?.detail;

    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === 'string') {
        return first.msg;
      }
      return fallback;
    }

    if (detail && typeof detail === 'object') {
      const maybeMsg = (detail as { msg?: string }).msg;
      if (typeof maybeMsg === 'string') {
        return maybeMsg;
      }
    }

    return fallback;
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(form.password)) {
      setError('Password must contain at least 8 characters, including 1 uppercase, 1 lowercase, 1 digit, and 1 special character.');
      return;
    }

    if (!captchaToken) {
      setError('Please verify the captcha');
      return;
    }

    setLoading(true);

    try {
      const { confirm_password, ...submitData } = form;
      const registerRes = await authAPI.register({
        ...submitData,
        captcha_token: captchaToken || undefined,
      });
      setEmailOtpDebug(registerRes.data.otp_debug || '');
      setStep('verify-email');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to start registration');
      const axiosErr = err as AxiosError<{ detail?: string }>;

      // Handle rate limiting
      if (axiosErr.response?.status === 429) {
        setError('Too many attempts. Please try again later.');
      } else if (errorMsg.includes('must start with 6')) {
        setError('Phone number must start with 6, 7, 8, or 9');
      } else {
        setError(errorMsg);
      }

      setCaptchaToken(null);
      setCaptchaAttempts(prev => prev + 1);

      // Auto-escalate to interactive on first failure
      if (captchaAttempts === 0 && captchaRef.current) {
        captchaRef.current.escalateToInteractive();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOtpVerify = async () => {
    setError('');
    setLoading(true);

    try {
      await authAPI.verifyEmailOtpForRegistration(form.email, emailOtp);
      const phoneRes = await authAPI.sendPhoneOtpForRegistration(form.phone);
      setPhoneOtpDebug(phoneRes.data.otp_debug || '');
      setStep('verify-phone');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to send phone OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtpVerify = async () => {
    setError('');
    setLoading(true);

    try {
      const { confirm_password, ...submitData } = form;
      const res = await authAPI.completeRegistration({
        ...submitData,
        email_otp: emailOtp,
        phone_otp: phoneOtp,
      });
      setRegisteredUser(res.data.user);
      setStep('terms');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updatePhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    // Validate Indian phone format (must start with 6-9)
    if (digitsOnly.length > 0 && !/^[6-9]/.test(digitsOnly)) {
      setError('Phone number must start with 6, 7, 8, or 9');
    } else {
      setError('');
    }
    update('phone', digitsOnly);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src={logo}
            alt="WealthVault Logo"
            style={{
              height: '180px',
              width: 'auto',
              display: 'block',
              margin: '0 auto -50px'
            }}
          />
          <h1 style={{ margin: 0 }}>WealthVault</h1>
          <p>
            {step === 'form' && 'Create your secure account'}
            {step === 'verify-email' && 'Verify your email'}
            {step === 'verify-phone' && 'Verify your phone'}
            {step === 'terms' && 'Review terms and conditions'}
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
                placeholder="9876543210 (starts with 6-9)"
                value={form.phone}
                onChange={(e) => updatePhone(e.target.value)}
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Min. 8 characters with 1 upppercase, 1 digit, 1 special char"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  minLength={8}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Confirm your password"
                  value={form.confirm_password}
                  onChange={(e) => update('confirm_password', e.target.value)}
                  required
                  minLength={8}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <TurnstileWidget
                ref={captchaRef}
                onVerify={setCaptchaToken}
                className="my-4"
                initialMode="normal"
              />
            </div>
            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading || form.phone.length !== 10}
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
                Debug OTP: <strong>{emailOtpDebug}</strong>
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
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                Debug OTP: <strong>{phoneOtpDebug}</strong>
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
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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

        {step === 'terms' && (
          <div className="terms-container" style={{ textAlign: 'left' }}>
            <div style={{ maxHeight: 220, overflowY: 'auto', padding: 16, border: '1px solid var(--border-color)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-color)', marginBottom: 20, backgroundColor: 'var(--bg-secondary)' }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}>Welcome to WealthVault. By accessing our platform, you agree to the following terms:</p>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
                <li><strong>Data Privacy:</strong> We encrypt your financial data natively. We do not sell your personal data.</li>
                <li><strong>Compliance:</strong> Certain high-value transactions may trigger RBI compliance reviews internally.</li>
                <li><strong>KYC Mandate:</strong> You must complete Identity Verification to unlock standard account features.</li>
                <li><strong>Account Security:</strong> You are responsible for keeping your login and OTP details safe.</li>
              </ul>
              <p style={{ marginTop: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>Violation of these terms may lead to account suspension or freezing.</p>
            </div>

            <button
              id="accept-terms-btn"
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={() => {
                login(registeredUser);
                navigate('/dashboard');
              }}
            >
              I Agree & Continue
            </button>
          </div>
        )}

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
