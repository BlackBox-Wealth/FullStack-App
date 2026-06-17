import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import axios from 'axios';
import { Eye, EyeOff, ShieldAlert, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

type Phase = 'check' | 'login' | 'caught' | 'wrong_role';

const PhishingLanding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const { isAuthenticated, isRehydrating, user, login } = useAuthStore();

  const [phase, setPhase] = useState<Phase>('check');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reportCredentialSubmission = async () => {
    if (!token) return;
    try {
      await axios.post(`/api/sim/phishing/credentials/${token}`, {}, { withCredentials: true });
    } catch {
      // best-effort — don't block reveal on failure
    }
  };

  useEffect(() => {
    if (isRehydrating) return;

    if (isAuthenticated && user) {
      if (user.role === 'employee' || user.role === 'relationship_manager') {
        reportCredentialSubmission();
        setPhase('caught');
      } else {
        setPhase('wrong_role');
      }
    } else {
      setPhase('login');
    }
  }, [isRehydrating, isAuthenticated, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(
        '/api/v1/auth/login',
        { email, password },
        { withCredentials: true }
      );
      const userData = res.data.user;
      if (userData.role !== 'employee' && userData.role !== 'relationship_manager') {
        setError('This portal is for PSB bank staff only. Customer accounts are not permitted.');
        setLoading(false);
        return;
      }
      login(userData);
      await reportCredentialSubmission();
      setPhase('caught');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Invalid credentials. Please try again.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'check' || isRehydrating) {
    return (
      <div style={styles.page}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Verifying session…</div>
      </div>
    );
  }

  if (phase === 'wrong_role') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 420, textAlign: 'center' }}>
          <AlertTriangle size={40} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#1e293b', marginBottom: 8 }}>Employee Portal Access Only</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
            This portal is restricted to PSB bank staff. Your current account does not have access.
          </p>
          <button
            style={styles.primaryBtn}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'caught') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 600 }}>
          {/* Header banner */}
          <div style={styles.alertBanner}>
            <ShieldAlert size={28} color="#fff" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Security Awareness Training</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>This was a simulated phishing exercise</div>
            </div>
          </div>

          <h2 style={{ color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={22} /> You clicked a phishing link
          </h2>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            The email you received was a <strong>simulated phishing attempt</strong> sent by your organisation's
            security team as part of an ongoing awareness programme. Your response has been recorded.
          </p>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>What happened?</div>
            <ul style={styles.list}>
              <li>You received a phishing email impersonating a trusted authority (RBI / IT Helpdesk / HR).</li>
              <li>You clicked the link in the email, which is how attackers harvest credentials or deliver malware.</li>
              <li>In a real attack, this could have compromised your account and customer data.</li>
            </ul>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Red flags to look for</div>
            <ul style={styles.list}>
              <li><strong>Spoofed sender domain</strong> — e.g. rbi-verify.in instead of rbi.org.in</li>
              <li><strong>Urgency pressure</strong> — "expires in 2 hours", "immediate action required"</li>
              <li><strong>Credential requests via link</strong> — legitimate services never ask you to log in via an emailed link</li>
              <li><strong>Mismatched URLs</strong> — hover over links before clicking to check the real destination</li>
            </ul>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>What you should do</div>
            <ul style={styles.list}>
              <li><CheckCircle size={14} color="#059669" style={{ display: 'inline', marginRight: 6 }} />
                Report suspicious emails to your IT Security team immediately.
              </li>
              <li><CheckCircle size={14} color="#059669" style={{ display: 'inline', marginRight: 6 }} />
                Never click links in emails asking for credentials — navigate to the portal directly.
              </li>
              <li><CheckCircle size={14} color="#059669" style={{ display: 'inline', marginRight: 6 }} />
                If you entered credentials on a suspicious site, change your password immediately.
              </li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button
              style={styles.primaryBtn}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => navigate('/admin/notifications')}
            >
              View Security Alerts
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
            Your participation data has been anonymised and will be used to improve security training.
            Contact IT Security at <strong>security@psb-internal.in</strong> with any questions.
          </p>
        </div>
      </div>
    );
  }

  // phase === 'login'
  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 420 }}>
        {/* Fake PSB internal portal header */}
        <div style={styles.portalHeader}>
          <div style={styles.bankLogo}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>PSB</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2b4a' }}>Punjab & Sind Bank</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Internal Employee Portal</div>
          </div>
        </div>

        <div style={styles.badge}>🔒 Employee Access Only</div>

        <p style={{ color: '#374151', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          Your session has expired or you are accessing a restricted employee resource.
          Please sign in with your PSB staff credentials to continue.
        </p>

        {error && (
          <div style={styles.errorBox}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Staff Email / Employee ID</label>
            <input
              type="email"
              style={styles.input}
              placeholder="name@psb.co.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                style={{ ...styles.input, paddingRight: 40 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            style={{ ...styles.primaryBtn, width: '100%', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In to Employee Portal'}
          </button>
        </form>

        <div style={styles.footerNote}>
          <ExternalLink size={12} />
          <span>Secured by PSB IT Security · psb-employee-portal.in</span>
        </div>
        <div style={styles.footerNote}>
          © 2025 Punjab & Sind Bank — Authorised Personnel Only
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    padding: '36px 32px',
    width: '100%',
    boxShadow: '0 2px 20px rgba(0,0,0,0.12)',
  },
  alertBanner: {
    background: '#dc2626',
    color: '#fff',
    borderRadius: 8,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  portalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid #e5e7eb',
  },
  bankLogo: {
    width: 48,
    height: 48,
    background: '#1a2b4a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    background: '#fef3c7',
    color: '#92400e',
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 16,
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    padding: '10px 14px',
    color: '#dc2626',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  formGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    color: '#374151',
    fontWeight: 600,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
  },
  primaryBtn: {
    padding: '11px 20px',
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '11px 20px',
    background: '#f1f5f9',
    color: '#1e293b',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  section: {
    marginBottom: 16,
    padding: '14px 16px',
    background: '#f8fafc',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 8,
  },
  list: {
    paddingLeft: 18,
    margin: 0,
    color: '#374151',
    fontSize: 13,
    lineHeight: 1.7,
  },
  footerNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 11,
  },
};

export default PhishingLanding;
