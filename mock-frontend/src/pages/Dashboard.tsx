import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertCircle,
  TrendingUp,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { usePhishingStore } from '../store';
import { trackPageEnter, trackPageLeave, trackClick } from '../tracker';

const Dashboard: React.FC = () => {
  const { user, context } = usePhishingStore();
  const navigate = useNavigate();

  useEffect(() => {
    trackPageEnter('/dashboard');
    return () => trackPageLeave('/dashboard');
  }, []);

  const handleTaskClick = () => {
    trackClick('dashboard_pending_task_cta', { task: context?.task_title });
    navigate('/admin/notifications');
  };

  const stats = [
    { label: 'Cases Handled', value: '48', change: '+3 this week', icon: FileText, color: 'purple' },
    { label: 'Active Customers', value: '124', change: '+12 this month', icon: Users, color: 'green' },
    { label: 'Pending Reviews', value: '7', change: '2 due today', icon: Clock, color: 'orange' },
    { label: 'Resolved Today', value: '12', change: 'Excellent progress', icon: CheckCircle2, color: 'blue' },
  ];

  const activityFeed = [
    { icon: Activity, text: 'KYC verification approved for Ravi Kumar', time: '10 min ago', color: 'var(--success)' },
    { icon: AlertCircle, text: 'Loan application #LN-8821 flagged for review', time: '32 min ago', color: 'var(--warning)' },
    { icon: TrendingUp, text: 'Monthly performance report available', time: '1 hr ago', color: 'var(--info)' },
    { icon: Users, text: 'New customer onboarding: Priya Sharma', time: '2 hr ago', color: 'var(--accent-primary)' },
    { icon: CheckCircle2, text: 'Account closure request processed', time: '3 hr ago', color: 'var(--success)' },
  ];

  const quickLinks = [
    { label: 'KYC Verification', path: '/admin/kyc', emoji: '🪪' },
    { label: 'Loan Processing', path: '/admin/loans', emoji: '💳' },
    { label: 'Notifications', path: '/admin/notifications', emoji: '🔔' },
    { label: 'Support', path: '/support', emoji: '🛡️' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Good morning, {user?.name?.split(' ')[0]} 👋</h2>
          <p>Here's what's happening at your branch today</p>
        </div>
        {/* Generate Report button removed (non-functional) */}
      </div>

      {/* Pending Task Banner (phishing hook) */}
      {context && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(245,158,11,0.08) 100%)',
            border: '1px solid rgba(220,38,38,0.25)',
            borderRadius: 'var(--border-radius)',
            padding: '18px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bell size={20} color="var(--danger)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {context.task_title}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {context.task_description} — Action required before end of day
              </div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleTaskClick}>
            {context.task_cta}
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${color}`}>
              <Icon size={20} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-change positive">
              <TrendingUp size={12} />
              {change}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-subtitle">Your branch activity today</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activityFeed.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: i < activityFeed.length - 1 ? '1px solid var(--border-color)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => trackClick('activity_item', { index: i })}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `${item.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={item.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {item.text}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">Quick Access</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {quickLinks.map(({ label, path, emoji }) => (
                <button
                  key={path}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 10, padding: '12px 14px' }}
                  onClick={() => {
                    trackClick('quick_link', { label, path });
                    navigate(path);
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
                  <span style={{ fontSize: '0.82rem' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compliance notice */}
          <div
            style={{
              background: 'var(--info-bg)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: 'var(--border-radius)',
              padding: '16px 18px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--info)', marginBottom: 6 }}>
              📋 Compliance Reminder
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Annual staff declarations are due by 31 May 2025. Ensure all forms are completed and submitted via the HR portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
