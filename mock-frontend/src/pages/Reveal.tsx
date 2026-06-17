import React, { useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  BookOpen,
  Award,
  X,
} from 'lucide-react';
import { usePhishingStore, type BehaviorEvent } from '../store';
import { useNavigate } from 'react-router-dom';
import portalApi, { fetchInbox } from '../api';
import { stopTracker } from '../tracker';

const Reveal: React.FC = () => {
  const { user, events, score, context } = usePhishingStore();
  const navigate = useNavigate();
  const [reportSenderEmail, setReportSenderEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    stopTracker();
  }, []);

  // Fetch any report inbox email created for this attempt and use its sender as authoritative contact
  React.useEffect(() => {
    let mounted = true;
    async function findReportSender() {
      try {
        const res = await fetchInbox();
        const raw = res?.data?.emails || res?.emails || res?.data?.data?.emails || [];
        const report = raw.find((e: any) => e.is_report && e.attempt_id && context?.attempt_id && e.attempt_id === context.attempt_id);
        if (mounted && report && report.sender_email) setReportSenderEmail(report.sender_email);
      } catch (err) {
        // ignore
      }
    }
    if (context?.attempt_id) findReportSender();
    return () => { mounted = false; };
  }, [context?.attempt_id]);

  const { riskLevel, riskColor, riskBg } = useMemo(() => {
    if (score >= 80) return { riskLevel: 'Excellent Awareness', riskColor: '#0f9d58', riskBg: 'rgba(15,157,88,0.1)' };
    if (score >= 60) return { riskLevel: 'Good Awareness', riskColor: '#0f766e', riskBg: 'rgba(15,118,110,0.1)' };
    if (score >= 40) return { riskLevel: 'Needs Improvement', riskColor: '#d97706', riskBg: 'rgba(217,119,6,0.1)' };
    return { riskLevel: 'High Risk', riskColor: '#dc2626', riskBg: 'rgba(220,38,38,0.1)' };
  }, [score]);

  const mistakes = buildMistakes(events);
  const timeline = buildTimeline(events);
  const reported = events.some((e) => e.type === 'reported_phishing');

  return (
    <div className="reveal-overlay">
      <div className="reveal-card">
        <button
          aria-label="Close"
          title="Close"
          onClick={() => usePhishingStore.getState().closeReveal()}
          className="reveal-close"
        >
          <X size={16} />
        </button>
        {/* Header */}
        <div
          style={{
            background: '#dc2626',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <ShieldAlert size={26} color="white" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>
              Security Awareness Training
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>
              This was a simulated phishing exercise run by your IT Security team
            </div>
          </div>
        </div>

        {/* Score */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: riskBg,
              border: `1px solid ${riskColor}40`,
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: riskColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Security Score
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: riskColor, lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ fontSize: '0.75rem', color: riskColor, marginTop: 4, fontWeight: 600 }}>
              {riskLevel}
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {reported ? 'Great Job!' : 'Actions Taken'}
            </div>
            {reported ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <CheckCircle size={28} color="var(--success)" />
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--success)' }}>
                  Reported Phishing
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                {mistakes.length} issue{mistakes.length !== 1 ? 's' : ''} identified
                <br />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  See details below
                </span>
              </div>
            )}
          </div>
        </div>

        {/* What happened */}
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 4 }}>What Happened</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {user ? `${user.name.split(' ')[0]}, you` : 'You'} received a phishing email impersonating
            the <strong>{context?.sender_name || 'PSB HR Department'}</strong>. This email was crafted by your organisation's
            security team as part of an ongoing awareness programme. Your actions during this session
            have been recorded and scored.
          </p>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>Your Activity Timeline</h3>
            <div>
              {timeline.map((item, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot ${item.sentiment}`}>
                    {item.sentiment === 'positive' ? (
                      <CheckCircle size={18} />
                    ) : item.sentiment === 'negative' ? (
                      <XCircle size={18} />
                    ) : (
                      <Clock size={18} />
                    )}
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mistakes */}
        {mistakes.length > 0 && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="var(--danger)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--danger)' }}>
                Issues Identified
              </h3>
            </div>
            <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
              {mistakes.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {/* Red flags */}
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid rgba(217,119,6,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--warning)', marginBottom: 10 }}>
            🚩 Red Flags You Should Have Noticed
          </div>
          <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.8 }}>
            <li><strong>Spoofed sender domain:</strong> <code>internal-psb-portal.in</code> ≠ <code>psb.co.in</code></li>
            <li><strong>Extreme urgency:</strong> "Failure to act will result in account suspension" — a pressure tactic</li>
            <li><strong>Credential request via link:</strong> Legitimate systems never ask for passwords through email CTAs</li>
            <li><strong>Sensitive data collection:</strong> Real HR forms don't ask for bank account details via email links</li>
            <li><strong>Generic greeting:</strong> Legitimate HR emails address you by name, not just "Dear Employee"</li>
          </ul>
        </div>

        {/* Recommendations */}
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
            <BookOpen size={16} style={{ display: 'inline', marginRight: 6 }} />
            Recommended Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Always verify the sender\'s email domain before clicking any link',
              'Hover over links to preview the actual URL before clicking',
              'When in doubt, contact the supposed sender via official channels — not via the email',
              'Use the "Report Suspicious" button in the portal to flag phishing attempts',
              'Never enter credentials on pages reached via emailed links',
              'Complete the mandatory cybersecurity awareness module on the Learning Hub',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Award */}
        {reported && (
          <div
            style={{
              background: 'var(--success-bg)',
              border: '1px solid rgba(15,157,88,0.2)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Award size={28} color="var(--success)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>
                Excellent Security Behaviour!
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                You correctly identified and reported the phishing attempt. This is exactly the right
                response. Your awareness helps protect the entire organisation.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
          <button
            className="btn btn-primary"
            onClick={() => { usePhishingStore.getState().closeReveal(); navigate('/dashboard'); }}
          >
            Return to Main Portal
            <ChevronRight size={16} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { usePhishingStore.getState().closeReveal(); navigate('/learn'); }}
          >
            <BookOpen size={15} />
            Security Learning Hub
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
          Your participation data is anonymised and used only to improve security training. A personalised
          report will be sent to <strong>{user?.email}</strong>. Contact{' '}
          <strong>{reportSenderEmail || context?.sender_email || 'security@psb-internal.in'}</strong> with any questions.
        </p>
      </div>
    </div>
  );
};

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/admin/notifications': 'Notifications / Inbox',
  '/inbox': 'Inbox',
  '/task': 'HR Declaration Form',
  '/admin/loans': 'Loan Management',
  '/admin/kyc': 'KYC Verification',
  '/learn': 'Learning Hub',
  '/faq': 'FAQ',
  '/support': 'Support',
};

function buildTimeline(events: BehaviorEvent[]) {
  type Sentiment = 'positive' | 'negative' | 'neutral';

  const EVENT_LABELS: Record<string, { label: (e: BehaviorEvent) => string; sentiment: Sentiment | ((e: BehaviorEvent) => Sentiment) }> = {
    session_started: { label: () => 'Opened phishing link and entered mock portal', sentiment: 'negative' },
    page_visit: {
      label: (e) => {
        const page = (e.data?.page as string) || e.page;
        const friendly = PAGE_LABELS[page] || page;
        return `Navigated to ${friendly}`;
      },
      sentiment: 'neutral',
    },
    phishing_email_opened: { label: () => 'Opened the phishing email', sentiment: 'negative' },
    phishing_email_cta_clicked: { label: () => 'Clicked the malicious call-to-action button', sentiment: 'negative' },
    notification_email_open: { label: () => 'Opened phishing email from inbox', sentiment: 'negative' },
    form_field_focus: {
      label: (e: BehaviorEvent) => `Accessed sensitive field: ${(e.data?.field as string) || 'unknown'}`,
      sentiment: 'negative',
    },
    form_field_input: {
      label: (e: BehaviorEvent) => e.data?.is_sensitive
        ? `Typed into sensitive field: ${(e.data?.field as string) || 'unknown'}`
        : `Filled in form field: ${(e.data?.field as string) || 'unknown'}`,
      sentiment: (e: BehaviorEvent) => e.data?.is_sensitive ? 'negative' : 'neutral',
    },
    credentials_submitted: { label: () => 'Submitted credentials on phishing page (critical mistake)', sentiment: 'negative' },
    task_completed: { label: () => 'Completed full phishing task — highest risk action', sentiment: 'negative' },
    reported_phishing: { label: () => 'Correctly identified and reported the phishing attempt', sentiment: 'positive' },
    scroll_depth: {
      label: (e) => `Scrolled to ${e.data?.percent}% of page`,
      sentiment: 'neutral',
    },
  };

  // Deduplicate page_visit events (keep only first visit per page)
  const seenPages = new Set<string>();
  const deduplicated = events.filter((e) => {
    if (e.type !== 'page_visit') return true;
    const page = (e.data?.page as string) || e.page;
    if (seenPages.has(page)) return false;
    seenPages.add(page);
    return true;
  });

  return deduplicated
    .filter((e) => EVENT_LABELS[e.type])
    .slice(0, 10)
    .map((e) => {
      const info = EVENT_LABELS[e.type];
      const sentiment = typeof info.sentiment === 'function' ? (info.sentiment as any)(e) : info.sentiment;
      return {
        label: info.label(e),
        sentiment: sentiment as Sentiment,
        time: new Date(e.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    });
}

function buildMistakes(events: BehaviorEvent[]): string[] {
  const mistakes: string[] = [];
  const types = new Set(events.map((e) => e.type));

  if (types.has('session_started') && !types.has('reported_phishing')) {
    mistakes.push('You clicked a link from an unverified external email address');
  }
  if (types.has('phishing_email_opened')) {
    mistakes.push('You opened a phishing email without verifying the sender domain');
  }
  if (types.has('phishing_email_cta_clicked')) {
    mistakes.push('You clicked the malicious call-to-action button in the email');
  }
  if (types.has('form_field_focus') || types.has('form_field_input')) {
    mistakes.push('You interacted with a fake form requesting sensitive information');
  }
  if (types.has('credentials_submitted')) {
    mistakes.push('You submitted your portal credentials on a phishing page — change your password immediately');
  }
  if (types.has('task_completed')) {
    mistakes.push('You completed the phishing task, including providing bank account details');
  }

  return mistakes;
}

export default Reveal;
