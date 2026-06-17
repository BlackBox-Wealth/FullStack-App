import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShieldAlert, Zap, CreditCard, PiggyBank, Lock,
  ChevronRight, X, GraduationCap,
} from 'lucide-react';
import { trackPageEnter, trackPageLeave, trackClick } from '../tracker';

interface LearningCard {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  content: string[];
  tips: string[];
}

const learningData: LearningCard[] = [
  {
    id: 'mf-basics',
    category: 'Investments',
    title: 'Mutual Funds 101',
    description: 'Pool your money with others to invest in a diversified portfolio managed by pros.',
    icon: <TrendingUp size={24} />,
    color: '#0f766e',
    content: [
      'Diversification: Spreads risk across multiple assets.',
      'Professional Management: Handled by experienced fund managers.',
      'Liquidity: Most funds allow you to withdraw anytime.',
      'Systematic Investment: Start small with monthly SIPs.',
    ],
    tips: ['Check the Expense Ratio before investing.', 'Align your choice with your risk appetite.'],
  },
  {
    id: 'phishing-alert',
    category: 'Security',
    title: 'Spotting Phishing',
    description: 'Learn how to identify fake emails, SMS, and websites designed to steal your data.',
    icon: <ShieldAlert size={24} />,
    color: '#dc2626',
    content: [
      'Urgency: Fraudsters use panic to make you act fast.',
      'Suspicious Links: Always hover over links to see the real URL.',
      'Generic Greetings: Banks usually address you by name.',
      'Request for Sensitive Data: Banks NEVER ask for PIN or OTP.',
    ],
    tips: ['Look for "https" and the padlock icon.', 'Never share OTP even with "bank officials".'],
  },
  {
    id: 'compounding',
    category: 'Literacy',
    title: 'Power of Compounding',
    description: 'The "Eighth Wonder of the World" — how small savings grow into massive wealth.',
    icon: <Zap size={24} />,
    color: '#ca8a04',
    content: [
      'Time is Money: Starting early is more important than the amount.',
      'Reinvestment: Earning interest on your interest.',
      'Patience: Real growth happens in the later years.',
      'Consistency: Regular contributions amplify the effect.',
    ],
    tips: ['Start an SIP today, even if it is just ₹500.', 'Reinvest dividends to maximize growth.'],
  },
  {
    id: 'credit-score',
    category: 'Credit',
    title: 'Building Credit Score',
    description: 'Understand what drives your CIBIL score and how to improve it.',
    icon: <CreditCard size={24} />,
    color: '#2563eb',
    content: [
      'Payment History (35%): Always pay on time — the biggest factor.',
      'Credit Utilisation (30%): Keep usage below 30% of your limit.',
      'Credit Age (15%): Older accounts help — don\'t close them.',
      'Credit Mix (10%): A mix of loans and cards helps.',
    ],
    tips: ['Check your CIBIL report annually for errors.', 'Avoid applying for multiple loans at once.'],
  },
  {
    id: 'savings',
    category: 'Savings',
    title: 'Emergency Fund Basics',
    description: 'Why every household needs 3–6 months of expenses set aside before investing.',
    icon: <PiggyBank size={24} />,
    color: '#7c3aed',
    content: [
      'Rule of Thumb: Save 3–6 months of living expenses.',
      'Where to Keep It: High-interest savings account or liquid funds.',
      'What Counts: Rent, food, utilities, EMIs, insurance.',
      'When to Use: Job loss, medical emergencies, urgent repairs.',
    ],
    tips: ['Automate a fixed transfer to your emergency fund each month.', 'Do NOT invest this money in equities.'],
  },
  {
    id: 'passwords',
    category: 'Security',
    title: 'Password Security',
    description: 'Best practices for creating and managing strong, unique passwords.',
    icon: <Lock size={24} />,
    color: '#0f766e',
    content: [
      'Length over Complexity: 16+ characters beats complex short passwords.',
      'Unique per Account: Never reuse passwords across sites.',
      'Use a Password Manager: LastPass, Bitwarden, 1Password.',
      '2FA Everywhere: Always enable two-factor authentication.',
    ],
    tips: ['Use a passphrase like "correct-horse-battery-staple".', 'Check haveibeenpwned.com for breaches.'],
  },
];

const categoryColors: Record<string, string> = {
  Investments: '#0f766e',
  Security: '#dc2626',
  Literacy: '#ca8a04',
  Credit: '#2563eb',
  Savings: '#7c3aed',
};

const Learn: React.FC = () => {
  const [selected, setSelected] = useState<LearningCard | null>(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    trackPageEnter('/learn');
    return () => trackPageLeave('/learn');
  }, []);

  const categories = ['All', ...Array.from(new Set(learningData.map((c) => c.category)))];
  const filtered = filter === 'All' ? learningData : learningData.filter((c) => c.category === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={20} /> Learning Hub
          </h2>
          <p>Financial literacy and security awareness resources</p>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setFilter(cat); trackClick('learn_filter', { category: cat }); }}
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: `1px solid ${filter === cat ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: filter === cat ? 'rgba(15,118,110,0.1)' : 'var(--bg-card)',
              color: filter === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-family)',
              fontSize: '0.82rem',
              fontWeight: filter === cat ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid-3">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="card"
            style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onClick={() => { setSelected(card); trackClick('learn_card_open', { id: card.id }); }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 3,
                background: card.color,
              }}
            />
            <div
              style={{
                width: 48, height: 48,
                borderRadius: 12,
                background: `${card.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
                color: card.color,
              }}
            >
              {card.icon}
            </div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: categoryColors[card.category] || 'var(--text-muted)',
                background: `${categoryColors[card.category] || '#6366f1'}14`,
                padding: '2px 8px',
                borderRadius: 4,
                marginBottom: 10,
              }}
            >
              {card.category}
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>{card.title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              {card.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.82rem', fontWeight: 600 }}>
              Read more <ChevronRight size={14} />
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(7,17,31,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-xl)',
              padding: 36,
              maxWidth: 560,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${selected.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selected.color }}>
                  {selected.icon}
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selected.title}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 20 }}>
              {selected.description}
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.875rem' }}>Key Concepts</div>
              {selected.content.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: i < selected.content.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${selected.color}18`, color: selected.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: 8 }}>
                💡 Quick Tips
              </div>
              {selected.tips.map((tip, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '4px 0', lineHeight: 1.5 }}>
                  • {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Learn;
