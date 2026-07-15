import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPortalSession } from '../api';
import { usePhishingStore } from '../store';
import { startTracker, track } from '../tracker';

type Phase = 'loading' | 'error';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Entry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { setSession, jwt: existingJwt } = usePhishingStore();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const loadSession = useCallback(async () => {
    setPhase('loading');
    setErrorMsg('');

    if (!token) {
      // If there's already an active session, just go to the dashboard
      if (existingJwt) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setErrorMsg('No session token found. This link may be invalid or expired.');
      setPhase('error');
      return;
    }

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { jwt, user, context } = await fetchPortalSession(token);
        setSession(jwt, user, context);
        startTracker();
        track('session_started', { token_present: true });
        navigate('/dashboard', { replace: true });
        return;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS);
      }
    }

    const msg = (lastErr as any)?.response?.data?.detail || 'Unable to start session. Please try again or contact your administrator.';
    setErrorMsg(msg);
    setPhase('error');
  }, [token, existingJwt]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (phase === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: 24,
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            padding: '40px 36px',
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h2 style={{ marginBottom: 10, fontSize: '1.2rem' }}>Session Unavailable</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {errorMsg}
          </p>
          {token && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 20, width: '100%' }}
              onClick={loadSession}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        background: 'var(--bg-primary)',
      }}
    >
      {/* PSB Branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: 'var(--accent-gradient)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 22,
            color: 'white',
          }}
        >
          P
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            PSB Employee Portal
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Punjab &amp; Sind Bank — Staff Access
          </div>
        </div>
      </div>

      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Verifying your session…
      </p>
    </div>
  );
};

export default Entry;
