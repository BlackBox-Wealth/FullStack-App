import React, { useEffect } from 'react';
import { ShieldAlert, Headphones, CalendarDays, PhoneCall, Mail, MessageCircleMore } from 'lucide-react';
import { trackPageEnter, trackPageLeave, trackClick, trackReportPhishing } from '../tracker';
import { usePhishingStore } from '../store';

const supportCards = [
  {
    title: 'Emergency fraud help',
    description: 'If you think someone is pressuring you to move money, freeze the account and contact support immediately.',
    icon: <ShieldAlert size={18} />,
    bg: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: 'rgba(220,38,38,0.2)',
  },
  {
    title: 'Account helpdesk',
    description: 'Use this for login problems, KYC questions, device verification, or recovery setup.',
    icon: <Headphones size={18} />,
    bg: 'var(--info-bg)',
    color: 'var(--info)',
    border: 'rgba(37,99,235,0.2)',
  },
  {
    title: 'Callback request',
    description: 'Book a callback for loan, investment, or account-service questions that need a person.',
    icon: <CalendarDays size={18} />,
    bg: 'rgba(15,118,110,0.1)',
    color: 'var(--accent-primary)',
    border: 'rgba(15,118,110,0.2)',
  },
];

const contactChannels = [
  { icon: <PhoneCall size={18} />, label: 'Helpline', value: '1800-XXX-XXXX (24×7 toll-free)', href: 'tel:1800XXXXXXX' },
  { icon: <Mail size={18} />, label: 'IT Security', value: 'security@psb-internal.in', href: 'mailto:security@psb-internal.in' },
  { icon: <MessageCircleMore size={18} />, label: 'Internal Chat', value: 'Teams / Slack #it-support', href: '#' },
];

const Support: React.FC = () => {
  useEffect(() => {
    trackPageEnter('/support');
    return () => trackPageLeave('/support');
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Support</h2>
          <p>Fast paths for urgent help, account issues, and regulatory guidance</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Support cards */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Support Paths
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {supportCards.map((card) => (
              <div
                key={card.title}
                style={{
                  background: card.bg,
                  border: `1px solid ${card.border}`,
                  borderRadius: 'var(--border-radius)',
                  padding: '18px 20px',
                  display: 'flex',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onClick={() => trackClick('support_card', { title: card.title })}
              >
                <div
                  style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: card.color,
                    flexShrink: 0,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: card.color, marginBottom: 4 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {card.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact channels */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Contact Us
          </div>
          <div className="card">
            {contactChannels.map((ch, i) => (
              <a
                key={ch.label}
                href={ch.href}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '14px 0',
                  borderBottom: i < contactChannels.length - 1 ? '1px solid var(--border-color)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                onClick={() => trackClick('support_contact', { channel: ch.label })}
              >
                <div
                  style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: 'var(--info-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--info)',
                    flexShrink: 0,
                  }}
                >
                  {ch.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 2 }}>{ch.label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{ch.value}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Report phishing box */}
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 'var(--border-radius)',
              padding: '18px 20px',
              marginTop: 16,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6, fontSize: '0.875rem' }}>
              🚨 Report a Phishing Attempt
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Received a suspicious email claiming to be from PSB? Use the <strong>Report</strong> button in
              the header or forward the email to <strong>security@psb-internal.in</strong> immediately.
            </p>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                trackClick('support_report_phishing');
                trackReportPhishing();
                usePhishingStore.getState().triggerReveal();
              }}
            >
              Report Suspicious Email Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Support;
