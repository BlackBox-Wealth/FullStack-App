import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShieldCheck, ShieldAlert, FileSearch, RefreshCw, Mail, Star, Archive, Search } from 'lucide-react';
import { type FakeEmail } from '../api';
import { usePhishingStore } from '../store';
import {
  trackPageEnter, trackPageLeave, trackClick, trackPhishingEmailOpened,
} from '../tracker';

type Tab = 'alerts' | 'messages';

const AVATAR_COLORS = [
  '#6366f1', '#0f766e', '#d97706', '#dc2626',
  '#2563eb', '#7c3aed', '#059669', '#db2777',
];

interface NotifSummary {
  kyc_pending: number;
  kyc_escalated: number;
  loans_pending: number;
  fraud_alerts: number;
  total_alerts: number;
}

const AdminNotifications: React.FC = () => {
  const [tab, setTab] = useState<Tab>('messages');
  const [summary, setSummary] = useState<NotifSummary | null>(null);
  const [emails, setEmails] = useState<FakeEmail[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { context } = usePhishingStore();

  useEffect(() => {
    trackPageEnter('/admin/notifications');
    return () => trackPageLeave('/admin/notifications');
  }, []);

  useEffect(() => {
    setSummary({ kyc_pending: 4, kyc_escalated: 1, loans_pending: 7, fraud_alerts: 2, total_alerts: 14 });
    setEmails(getFallbackEmails(context));
    setLoading(false);
    try { window.dispatchEvent(new CustomEvent('notificationsViewed')); } catch {};
  }, []);

  const filtered = emails.filter(
    (e) =>
      e.sender_name.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const handleEmailOpen = (email: FakeEmail) => {
    trackClick('notification_email_open', { id: email.id, is_phishing: email.is_phishing });
    if (email.is_phishing) trackPhishingEmailOpened(email.id);
    setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, is_read: true } : e));
    try { window.dispatchEvent(new CustomEvent('notificationsViewed')); } catch {};
    navigate(`/inbox/${email.id}`);
  };

  const alertCards = [
    { label: 'KYC Pending', value: summary?.kyc_pending ?? '—', icon: ShieldCheck, color: 'orange', path: '/admin/kyc' },
    { label: 'KYC Escalated', value: summary?.kyc_escalated ?? '—', icon: ShieldAlert, color: 'blue', path: '/admin/kyc' },
    { label: 'Loans Pending', value: summary?.loans_pending ?? '—', icon: FileSearch, color: 'purple', path: '/admin/loans' },
    { label: 'Fraud Alerts', value: summary?.fraud_alerts ?? '—', icon: ShieldAlert, color: 'red', path: '/admin/fraud' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} /> Notification Center
          </h2>
          <p>Real-time alerts, pending actions, and internal messages</p>
        </div>
        <div className="badge-status verified" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
          {summary?.total_alerts ?? '—'} Total Alerts
        </div>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 24,
          background: 'rgba(20,32,51,0.04)',
          border: '1px solid var(--border-color)',
          borderRadius: 999,
          padding: 4,
          width: 'fit-content',
        }}
      >
        {(['alerts', 'messages'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); trackClick('notifications_tab', { tab: t }); }}
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              border: 'none',
              fontFamily: 'var(--font-family)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t === 'alerts' ? 'Alerts' : 'Messages'}{' '}
            {t === 'messages' && emails.filter((e) => !e.is_read).length > 0 && (
              <span
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  borderRadius: 999,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: 4,
                }}
              >
                {emails.filter((e) => !e.is_read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === 'alerts' && (
        <div>
          <div className="stats-grid">
            {alertCards.map(({ label, value, icon: Icon, color, path }) => (
              <div
                key={label}
                className="stat-card"
                style={{ cursor: 'pointer' }}
                onClick={() => { trackClick('notification_alert_card', { label }); navigate(path); }}
              >
                <div className={`stat-icon ${color}`}><Icon size={20} /></div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
                <div className="stat-change" style={{ color: 'var(--warning)' }}>Requires attention</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">System Alerts</div>
            </div>
            {[
              { text: 'KYC batch verification pending from 23 May 2025', time: '2h ago', type: 'warning' },
              { text: 'Fraud alert: Unusual transaction pattern on Account #8821', time: '4h ago', type: 'danger' },
              { text: 'New RBI circular: Updated KYC norms effective 1 June 2025', time: '1d ago', type: 'info' },
              { text: 'System maintenance scheduled: Saturday 11 PM – Sunday 2 AM', time: '2d ago', type: 'neutral' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 0',
                  borderBottom: i < 3 ? '1px solid var(--border-color)' : 'none',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.type === 'danger' ? 'var(--danger)' : item.type === 'warning' ? 'var(--warning)' : item.type === 'info' ? 'var(--info)' : 'var(--text-muted)',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.text}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages (inbox) tab */}
      {tab === 'messages' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search
              size={16}
              style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: 40 }}
              placeholder="Search messages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No messages found
              </div>
            ) : (
              <div>
                {filtered.map((email, idx) => {
                  const color = email.avatar_color || AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const initials = email.sender_name
                    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={email.id}
                      className={`email-item${!email.is_read ? ' unread' : ''}`}
                      style={{ paddingRight: 44 }}
                      onClick={() => handleEmailOpen(email)}
                    >
                      <div className="email-avatar" style={{ background: color }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="email-sender">{email.sender_name}</div>
                          <div className="email-time">{formatTime(email.timestamp)}</div>
                        </div>
                        <div className="email-subject">{email.subject}</div>
                        <div className="email-preview">{email.preview}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ts; }
}

function getFallbackEmails(context: any): FakeEmail[] {
  const now = new Date();
  const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  return [
    {
      id: 'phishing-sim',
      sender_name: context?.sender_name || 'HR – Annual Declaration',
      sender_email: 'hr-policy@internal-psb-portal.in',
      subject: context?.email_subject || '⚠️ ACTION REQUIRED: Annual HR Declaration Due Today',
      preview: 'You have not yet completed your annual HR declaration. Immediate action required.',
      body_html: '',
      timestamp: ago(12),
      is_phishing: true,
      is_read: false,
      category: 'hr',
      avatar_color: '#dc2626',
    },
    {
      id: 'noise-1',
      sender_name: 'HR Department',
      sender_email: 'hr@psb-internal.in',
      subject: 'Reminder: Annual Leave Balance Update — FY 2025-26',
      preview: 'Dear Team, Please review your leave balance before the quarter closes...',
      body_html: '<p>Please review your leave balance before the end of Q2.</p>',
      timestamp: ago(90),
      is_phishing: false,
      is_read: true,
      category: 'hr',
      avatar_color: '#7c3aed',
    },
    {
      id: 'noise-2',
      sender_name: 'IT Helpdesk',
      sender_email: 'helpdesk@psb-internal.in',
      subject: 'Action Required: Password Expiry in 30 Days',
      preview: 'Your system password will expire on 25th June 2025.',
      body_html: '<p>Your network password will expire in 30 days. Please reset it.</p>',
      timestamp: ago(180),
      is_phishing: false,
      is_read: true,
      category: 'it',
      avatar_color: '#2563eb',
    },
    {
      id: 'noise-3',
      sender_name: 'Finance Team',
      sender_email: 'finance@psb-internal.in',
      subject: 'Expense Submission Deadline — 31st May 2025',
      preview: 'All Q1 expense claims must be submitted by 31st May.',
      body_html: '<p>Submit all Q1 expense claims by 31 May 2025.</p>',
      timestamp: ago(360),
      is_phishing: false,
      is_read: true,
      category: 'finance',
      avatar_color: '#059669',
    },
    {
      id: 'noise-4',
      sender_name: 'Branch Manager',
      sender_email: 'manager@psb-internal.in',
      subject: 'Team Meeting — Monday 27th May, 10:00 AM',
      preview: 'Quick reminder about our weekly sync on Monday morning.',
      body_html: '<p>Weekly sync: Monday 27 May, 10 AM, Conference Room B.</p>',
      timestamp: ago(600),
      is_phishing: false,
      is_read: false,
      category: 'general',
      avatar_color: '#d97706',
    },
    {
      id: 'noise-5',
      sender_name: 'Compliance Team',
      sender_email: 'compliance@psb-internal.in',
      subject: 'Q2 Compliance Training — Enrollment Open',
      preview: 'Q2 mandatory compliance training modules are now open.',
      body_html: '<p>Complete mandatory compliance training by 15 June 2025.</p>',
      timestamp: ago(1200),
      is_phishing: false,
      is_read: true,
      category: 'compliance',
      avatar_color: '#6366f1',
    },
  ];
}

export default AdminNotifications;
