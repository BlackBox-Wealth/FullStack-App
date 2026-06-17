import React, { useState, useEffect } from 'react';
import { ChevronDown, BookOpen, ShieldCheck, Wallet, Bot, LifeBuoy } from 'lucide-react';
import { trackPageEnter, trackPageLeave, trackClick } from '../tracker';

const faqItems = [
  {
    category: 'Onboarding',
    icon: <BookOpen size={16} />,
    question: 'How do I get started with WealthVault?',
    answer: 'Create an account, verify your identity, connect the accounts you want to monitor, and then review the dashboard for balances, transactions, and AI insights. The app is designed to surface the important parts first so you can act quickly.',
  },
  {
    category: 'Security',
    icon: <ShieldCheck size={16} />,
    question: 'What should I do if a message or call feels suspicious?',
    answer: 'Open Support, use the AI assistant for guidance, and if you suspect coercion or fraud, freeze the account or contact your bank immediately. WealthVault can highlight stress signals, but you should always verify with a human support channel for urgent cases.',
  },
  {
    category: 'Security',
    icon: <ShieldCheck size={16} />,
    question: 'How do I report a phishing email?',
    answer: 'Click the "Report" button in the top navigation or use the flag icon when viewing a suspicious message. The IT Security team will be notified immediately and can investigate the source. Never click links or download attachments from suspicious emails.',
  },
  {
    category: 'Money',
    icon: <Wallet size={16} />,
    question: 'How does spending analysis work?',
    answer: 'Transactions are grouped by category over time, then the dashboard turns that into a spending view and savings suggestions. The charts are there to make patterns obvious, not to bury you in data.',
  },
  {
    category: 'AI',
    icon: <Bot size={16} />,
    question: 'Can I ask the assistant personal finance questions?',
    answer: 'Yes. The current assistant is a general AI helper for budgeting, investments, and platform questions. It will later be replaced or augmented with a RAG-backed knowledge layer for more precise answers.',
  },
  {
    category: 'Recovery',
    icon: <ShieldCheck size={16} />,
    question: 'How do I protect my account if I lose access?',
    answer: 'Go to Settings and add a recovery email and phone number. Those recovery channels help verify your identity and speed up account restoration when needed.',
  },
  {
    category: 'Support',
    icon: <LifeBuoy size={16} />,
    question: 'Who do I contact for urgent issues?',
    answer: 'For urgent security incidents, contact IT Security at security@psb-internal.in or call the 24/7 helpline at 1800-XXX-XXXX. For account issues, use the Support page or raise a ticket through the IT portal.',
  },
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    trackPageEnter('/faq');
    return () => trackPageLeave('/faq');
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Frequently Asked Questions</h2>
          <p>Clear answers to the questions staff ask most often</p>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {faqItems.map((item, i) => (
          <div
            key={i}
            className="card"
            style={{
              marginBottom: 12,
              padding: '0',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onClick={() => {
              setOpenIndex(openIndex === i ? null : i);
              trackClick('faq_toggle', { index: i, question: item.question });
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32, height: 32,
                    borderRadius: 8,
                    background: 'var(--info-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--info)',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {item.category}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {item.question}
                  </div>
                </div>
              </div>
              <ChevronDown
                size={18}
                style={{
                  color: 'var(--text-muted)',
                  transition: 'transform 0.2s',
                  transform: openIndex === i ? 'rotate(180deg)' : 'none',
                  flexShrink: 0,
                }}
              />
            </div>
            {openIndex === i && (
              <div
                style={{
                  padding: '0 22px 18px',
                  paddingLeft: 66,
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: 16,
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;
