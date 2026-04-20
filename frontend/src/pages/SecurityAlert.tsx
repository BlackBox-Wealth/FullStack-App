import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { securityAPI } from '../api';
import { useAuthStore } from '../store';

const SecurityAlert: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'secured' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSecureAccount = async () => {
    setStatus('loading');
    try {
      await securityAPI.reportUnauthorizedLogin();
      logout();
      setStatus('secured');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Something went wrong. Please contact support.');
      setStatus('error');
    }
  };

  const handleItWasMe = () => {
    navigate('/dashboard');
  };

  return (
    <div className="security-alert-page">
      {/* Animated background */}
      <div className="security-bg">
        <div className="security-orb security-orb-1" />
        <div className="security-orb security-orb-2" />
        <div className="security-orb security-orb-3" />
      </div>

      <div className="security-card">
        {status === 'secured' ? (
          /* ── Success State ── */
          <div className="security-success">
            <div className="security-icon-wrap security-icon-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="security-title">Account Secured</h1>
            <p className="security-desc">
              Your account has been flagged and you've been logged out of all sessions.
              Our security team has been notified and will review the activity.
            </p>
            <div className="security-support-box">
              <p className="security-support-label">Need immediate help?</p>
              <p className="security-support-number">📞 1800-XXX-XXXX</p>
              <p className="security-support-email">📧 security@wealthvault.com</p>
            </div>
            <button
              className="security-btn security-btn-primary"
              onClick={() => navigate('/login')}
            >
              Go to Login
            </button>
          </div>
        ) : (
          /* ── Main Alert State ── */
          <>
            {/* Header */}
            <div className="security-alert-header">
              <div className="security-icon-wrap security-icon-danger">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="security-badge">Security Alert</div>
              <h1 className="security-title">Unrecognized Login Detected</h1>
              <p className="security-desc">
                We noticed a login from a <strong>new device or location</strong> on your WealthVault account.
                Please confirm whether this was you.
              </p>
            </div>

            {/* Info Cards */}
            <div className="security-info-grid">
              <div className="security-info-card">
                <div className="security-info-icon">🔒</div>
                <div>
                  <div className="security-info-title">Your data is safe</div>
                  <div className="security-info-text">We detected the login and are taking precautions</div>
                </div>
              </div>
              <div className="security-info-card">
                <div className="security-info-icon">📧</div>
                <div>
                  <div className="security-info-title">Alert email sent</div>
                  <div className="security-info-text">Full login details were emailed to your registered address</div>
                </div>
              </div>
              <div className="security-info-card">
                <div className="security-info-icon">⚡</div>
                <div>
                  <div className="security-info-title">Act immediately</div>
                  <div className="security-info-text">If this wasn't you, secure your account now</div>
                </div>
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && (
              <div className="security-error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="security-actions">
              <button
                id="btn-secure-account"
                className="security-btn security-btn-danger"
                onClick={handleSecureAccount}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <span className="security-spinner" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    This Wasn't Me — Secure My Account
                  </>
                )}
              </button>

              <button
                id="btn-it-was-me"
                className="security-btn security-btn-ghost"
                onClick={handleItWasMe}
                disabled={status === 'loading'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Yes, That Was Me — Continue
              </button>
            </div>

            {/* Support */}
            <div className="security-support-footer">
              <p>Need immediate assistance?</p>
              <div className="security-support-contacts">
                <a href="tel:1800XXXXXXX" className="security-contact-link">📞 1800-XXX-XXXX</a>
                <span className="security-contact-sep">·</span>
                <a href="mailto:security@wealthvault.com" className="security-contact-link">📧 security@wealthvault.com</a>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .security-alert-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          padding: 24px;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        .security-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .security-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          animation: security-pulse 6s ease-in-out infinite;
        }

        .security-orb-1 {
          width: 400px; height: 400px;
          background: #e11d48;
          top: -100px; left: -100px;
          animation-delay: 0s;
        }

        .security-orb-2 {
          width: 300px; height: 300px;
          background: #7c3aed;
          bottom: -80px; right: 80px;
          animation-delay: 2s;
        }

        .security-orb-3 {
          width: 250px; height: 250px;
          background: #dc2626;
          top: 60%; left: 60%;
          animation-delay: 4s;
        }

        @keyframes security-pulse {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.35; }
        }

        .security-card {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(225, 29, 72, 0.3);
          border-radius: 24px;
          padding: 48px 40px;
          max-width: 560px;
          width: 100%;
          position: relative;
          z-index: 1;
          box-shadow:
            0 0 0 1px rgba(225, 29, 72, 0.1),
            0 32px 64px -12px rgba(0, 0, 0, 0.6);
        }

        .security-alert-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .security-icon-wrap {
          width: 80px; height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .security-icon-danger {
          background: rgba(225, 29, 72, 0.15);
          border: 2px solid rgba(225, 29, 72, 0.4);
          color: #f87171;
          animation: security-icon-pulse 2s ease-in-out infinite;
        }

        .security-icon-success {
          background: rgba(34, 197, 94, 0.15);
          border: 2px solid rgba(34, 197, 94, 0.4);
          color: #4ade80;
        }

        @keyframes security-icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(225, 29, 72, 0); }
        }

        .security-badge {
          display: inline-block;
          background: rgba(225, 29, 72, 0.15);
          border: 1px solid rgba(225, 29, 72, 0.4);
          color: #f87171;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 14px;
          border-radius: 50px;
          margin-bottom: 16px;
        }

        .security-title {
          color: #f1f5f9;
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -0.025em;
        }

        .security-desc {
          color: #94a3b8;
          font-size: 15px;
          line-height: 1.7;
          margin: 0;
        }

        .security-info-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }

        .security-info-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 18px;
        }

        .security-info-icon {
          font-size: 22px;
          flex-shrink: 0;
        }

        .security-info-title {
          color: #e2e8f0;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 2px;
        }

        .security-info-text {
          color: #64748b;
          font-size: 13px;
        }

        .security-error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(225, 29, 72, 0.1);
          border: 1px solid rgba(225, 29, 72, 0.3);
          color: #f87171;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .security-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }

        .security-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 15px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .security-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .security-btn-danger {
          background: linear-gradient(135deg, #e11d48, #be123c);
          color: #fff;
          box-shadow: 0 8px 24px -4px rgba(225, 29, 72, 0.4);
        }

        .security-btn-danger:hover:not(:disabled) {
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          transform: translateY(-1px);
          box-shadow: 0 12px 32px -4px rgba(225, 29, 72, 0.5);
        }

        .security-btn-ghost {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #94a3b8;
        }

        .security-btn-ghost:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
          border-color: rgba(255,255,255,0.2);
        }

        .security-btn-primary {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: #fff;
          box-shadow: 0 8px 24px -4px rgba(59, 130, 246, 0.4);
        }

        .security-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px -4px rgba(59, 130, 246, 0.5);
        }

        .security-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .security-support-footer {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .security-support-footer p {
          color: #64748b;
          font-size: 13px;
          margin: 0 0 8px;
        }

        .security-support-contacts {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .security-contact-link {
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .security-contact-link:hover {
          color: #e2e8f0;
        }

        .security-contact-sep {
          color: #475569;
        }

        /* Success state */
        .security-success {
          text-align: center;
        }

        .security-support-box {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
        }

        .security-support-label {
          color: #94a3b8;
          font-size: 13px;
          margin: 0 0 8px;
        }

        .security-support-number {
          color: #e2e8f0;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px;
        }

        .security-support-email {
          color: #94a3b8;
          font-size: 14px;
          margin: 0;
        }

        @media (max-width: 600px) {
          .security-card {
            padding: 32px 24px;
          }
          .security-title {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
};

export default SecurityAlert;
