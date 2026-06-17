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

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const navigate = useNavigate();
  const { login, isAuthenticated, isRehydrating } = useAuthStore();
  const captchaRef = useRef<TurnstileWidgetRef>(null);
  const biometricData = useBiometrics();

  useEffect(() => {
    if (isAuthenticated && !isRehydrating) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isRehydrating, navigate]);

  const [securityRisk, setSecurityRisk] = useState<{ isAnomaly: boolean; riskLevel: string; confidence: number } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSecurityRisk(null);

    if (!captchaToken) {
      setError('Please verify the captcha');
      return;
    }

    setLoading(true);
    try {
      // 1. Send biometric telemetry (best effort). Do not block login if this fails.
      try {
        const bioResponse = await mlAPI.behavioralAnomaly(biometricData as any, email, { skipAuthRefresh: true });
        console.log('Biometric Check:', bioResponse.data);

        if (bioResponse.data.is_anomaly || bioResponse.data.risk_level === 'high') {
          setSecurityRisk({
            isAnomaly: bioResponse.data.is_anomaly,
            riskLevel: bioResponse.data.risk_level,
            confidence: bioResponse.data.confidence
          });

          // "Do something useful" - Add a delay to simulate extra security processing/inspection
          console.warn('Security Risk Detected: Behavioral patterns deviate from baseline.');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (bioErr) {
        console.warn('Biometric check skipped:', bioErr);
      }

      // 2. Perform regular login
      const res = await authAPI.login(email, password, captchaToken);

      login(res.data.user);
      toast.success(`Welcome back, ${res.data.user.full_name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const errorMsg = axiosErr.response?.data?.detail || 'Login failed';
      setError(errorMsg);
      toast.error(errorMsg);
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
          <p>Banking & Wealth Management</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {securityRisk && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={20} color="var(--warning)" />
            <div style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
              <strong>Security Alert:</strong> Suspicious interaction pattern detected. We are monitorning this session for your protection.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
            <TurnstileWidget
              ref={captchaRef}
              onVerify={setCaptchaToken}
              className="my-4"
              initialMode="normal"
            />
          </div>
          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link
            to="/forgot-password"
            style={{
              color: 'var(--accent-primary)',
              textDecoration: 'none',
              fontSize: '14px'
            }}
          >
            Forgot Password?
          </Link>
        </div>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(15,118,110,0.08)', borderRadius: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--accent-primary)' }}>Demo Accounts</strong>
          <span style={{ marginLeft: '6px', opacity: 0.7 }}>— click to autofill</span>
          <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { label: '👑 Admin', email: 'admin@wealthvault.com' },
              { label: '👨‍💼 Rel. Manager', email: 'rm1@wealthvault.com' },
              { label: '👨‍💼 Employee', email: 'employee1@wealthvault.com' },
              { label: '🧑 Customer', email: 'customer1@wealthvault.com' },
            ].map(acc => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword('password123'); }}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${email === acc.email ? 'var(--accent-primary)' : 'rgba(15,118,110,0.25)'}`,
                  background: email === acc.email ? 'rgba(15,118,110,0.15)' : 'rgba(15,118,110,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  color: email === acc.email ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
                onMouseEnter={e => {
                  if (email !== acc.email) {
                    e.currentTarget.style.background = 'rgba(15,118,110,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(15,118,110,0.5)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (email !== acc.email) {
                    e.currentTarget.style.background = 'rgba(15,118,110,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(15,118,110,0.25)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.3 }}>{acc.label}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.65, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                {email === acc.email && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700, marginTop: '2px' }}>✓ filled</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
