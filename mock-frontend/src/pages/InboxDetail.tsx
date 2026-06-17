import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, ChevronRight, Flag } from 'lucide-react';
import { fetchEmailDetail, reportEmail, type FakeEmail } from '../api';
import { usePhishingStore } from '../store';
import {
  trackPageEnter, trackPageLeave, trackClick,
  trackPhishingEmailOpened, trackReportPhishing,
} from '../tracker';

const InboxDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { context } = usePhishingStore();
  const [email, setEmail] = useState<FakeEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    trackPageEnter(`/inbox/${id}`);
    return () => trackPageLeave(`/inbox/${id}`);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Build phishing email from context if it's the sim email
    if (id === 'phishing-sim' || id === context?.phishing_email_id) {
      const phishingEmail = buildPhishingEmail(context);
      setEmail(phishingEmail);
      setLoading(false);
      trackPhishingEmailOpened(id);
      return;
    }

    fetchEmailDetail(id)
      .then(setEmail)
      .catch(() => {
        setEmail(getFallbackEmail(id));
      })
      .finally(() => setLoading(false));
  }, [id, context]);

  const handleReport = async () => {
    trackReportPhishing();
    if (id) {
      try { await reportEmail(id); } catch { /* best-effort */ }
    }
    setReported(true);
    usePhishingStore.getState().triggerReveal();
  };

  const handleTaskCTA = () => {
    trackClick('phishing_email_cta_clicked', { email_id: id });
    navigate('/task');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!email) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
        Email not found
      </div>
    );
  }

  const isPhishing = email.is_phishing;

  return (
    <div>
      {/* Back */}
      <button
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: 20 }}
        onClick={() => { trackClick('inbox_detail_back'); navigate('/admin/notifications'); }}
      >
        <ArrowLeft size={14} />
        Back to Inbox
      </button>

      <div className="card">
        {/* Email header */}
        <div
          style={{
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, flex: 1 }}>{email.subject}</h2>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="report-phishing-btn"
                onClick={handleReport}
                disabled={reported}
              >
                <Flag size={14} />
                {reported ? 'Reported' : 'Report Phishing'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <div
              className="user-avatar"
              style={{ background: isPhishing ? '#dc2626' : '#6366f1' }}
            >
              {email.sender_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{email.sender_name}</div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: isPhishing ? 'var(--danger)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isPhishing && <AlertTriangle size={12} />}
                {email.sender_email}
                {isPhishing && (
                  <span
                    style={{
                      background: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      marginLeft: 4,
                    }}
                  >
                    External Sender
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {new Date(email.timestamp).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Email body */}
        {email.body_html ? (
          <div
            style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        ) : (
          <EmailBody email={email} onCtaClick={handleTaskCTA} />
        )}

        {/* CTA for phishing email */}
        {isPhishing && (
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
            }}
          >
            <button className="btn btn-danger" onClick={handleTaskCTA}>
              {context?.task_cta || 'Complete Declaration'}
              <ChevronRight size={16} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                trackClick('phishing_email_cta_ignored');
                navigate('/dashboard');
              }}
            >
              Remind Me Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Renders a compelling phishing email body
const EmailBody: React.FC<{ email: FakeEmail; onCtaClick: () => void }> = ({ email, onCtaClick }) => {
  const { context } = usePhishingStore();

  if (!email.is_phishing) {
    return (
      <div style={{ lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <p>{email.preview}</p>
      </div>
    );
  }

  return (
    <div style={{ lineHeight: 1.8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
      <p>Dear Employee,</p>
      <br />
      <p>
        As part of our annual HR compliance process, all staff members are required to complete the{' '}
        <strong>Annual Staff Declaration Form 2025</strong> before <strong>today, 29 May 2025</strong>.
      </p>
      <br />
      <p>
        Our records indicate that your declaration has not yet been submitted. Failure to complete this
        form by end-of-day may result in a temporary suspension of your portal access and payroll
        processing delays.
      </p>
      <br />
      <div
        style={{
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8,
          padding: '14px 18px',
          margin: '20px 0',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6, fontSize: '0.85rem' }}>
          ⚠️ URGENT: Action Required Before 5:00 PM Today
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          Your employee ID has been flagged for incomplete HR compliance. Please complete your
          declaration immediately to avoid any disruption to your services.
        </p>
      </div>
      <p>The form takes approximately 5 minutes to complete. Please have the following ready:</p>
      <ul style={{ paddingLeft: 20, margin: '12px 0' }}>
        <li>Employee ID and Staff Number</li>
        <li>Current designation and department</li>
        <li>Updated contact information</li>
        <li>Bank account details for salary processing</li>
      </ul>
      <br />
      <p>
        Click the button below to access the secure HR Declaration Portal and complete your submission.
      </p>
      <br />
      <p>Regards,</p>
      <p>
        <strong>{context?.sender_name || 'HR Department'}</strong>
        <br />
        Human Resources Division
        <br />
        Punjab &amp; Sind Bank
        <br />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          hr-compliance@internal-psb-portal.in | +91-11-2575-2575
        </span>
      </p>
      <br />
      <div
        style={{
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
        }}
      >
        This is an automated message from the PSB HR Compliance System. Do not reply to this email.
        If you believe you received this in error, contact IT Helpdesk at ithelpdesk@psb.co.in
      </div>
    </div>
  );
};

function buildPhishingEmail(context: any): FakeEmail {
  const now = new Date();
  now.setMinutes(now.getMinutes() - 12);
  return {
    id: context?.phishing_email_id || 'phishing-sim',
    sender_name: context?.sender_name || 'HR – Annual Declaration',
    sender_email: 'hr-policy@internal-psb-portal.in',
    subject: context?.email_subject || '⚠️ ACTION REQUIRED: Annual HR Declaration Due Today',
    preview: 'You have not yet completed your annual HR declaration. Immediate action required.',
    body_html: '',
    timestamp: now.toISOString(),
    is_phishing: true,
    is_read: false,
    category: 'hr',
    avatar_color: '#dc2626',
  };
}

function getFallbackEmail(id: string): FakeEmail {
  const fallbacks: Record<string, FakeEmail> = {
    'noise-1': {
      id: 'noise-1', sender_name: 'HR Department', sender_email: 'hr@psb.co.in',
      subject: 'Leave Balance Update – May 2025',
      preview: 'Your leave balance has been updated for the current financial year.',
      body_html: '<p>Your leave balance has been updated. Please check the HR portal for details.</p>',
      timestamp: new Date(Date.now() - 90 * 60_000).toISOString(),
      is_phishing: false, is_read: true, category: 'hr', avatar_color: '#7c3aed',
    },
  };
  return fallbacks[id] || {
    id, sender_name: 'Internal System', sender_email: 'system@psb.co.in',
    subject: 'System Notification', preview: 'A system notification.',
    body_html: '<p>System notification.</p>',
    timestamp: new Date().toISOString(),
    is_phishing: false, is_read: true, category: 'general', avatar_color: '#6366f1',
  };
}

export default InboxDetail;
