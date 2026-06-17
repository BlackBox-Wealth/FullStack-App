import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Wallet, ChevronDown, Sparkle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import InlineAiChat from '../components/help/InlineAiChat';

const faqItems = [
  {
    category: 'Onboarding',
    icon: <BookOpen size={18} />,
    question: 'How do I get started with WealthVault?',
    answer:
      'Create an account, verify your identity, connect the accounts you want to monitor, and then review the dashboard for balances, transactions, and AI insights. The app is designed to surface the important parts first so you can act quickly.',
  },
  {
    category: 'Security',
    icon: <ShieldCheck size={18} />,
    question: 'What should I do if a message or call feels suspicious?',
    answer:
      'Open Support, use the AI assistant for guidance, and if you suspect coercion or fraud, freeze the account or contact your bank immediately. WealthVault can highlight stress signals, but you should always verify with a human support channel for urgent cases.',
  },
  {
    category: 'Money',
    icon: <Wallet size={18} />,
    question: 'How does spending analysis work?',
    answer:
      'Transactions are grouped by category over time, then the dashboard turns that into a spending view and savings suggestions. The charts are there to make patterns obvious, not to bury you in data.',
  },
  {
    category: 'AI',
    icon: <Sparkle size={18} />,
    question: 'Can I ask the assistant personal finance questions?',
    answer:
      'Yes. The current assistant is a general AI helper for budgeting, investments, and platform questions. It will later be replaced or augmented with a RAG-backed knowledge layer for more precise answers.',
  },
  {
    category: 'Recovery',
    icon: <ShieldCheck size={18} />,
    question: 'How do I protect my account if I lose access?',
    answer:
      'Go to Settings and add a recovery email and phone number. Those recovery channels help verify your identity and speed up account restoration when needed.',
  },
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Help center"
        title="FAQ"
        description="Clear answers to the questions customers ask most often, with AI help for anything not covered yet."
      />

      <div className="help-grid">
        <section className="card faq-card">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">Common questions</div>
              <h2>What people usually ask first</h2>
            </div>
          </div>

          <div className="faq-list">
            {faqItems.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <button
                  key={item.question}
                  type="button"
                  className={`faq-item ${isOpen ? 'open' : ''}`}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <div className="faq-item__top">
                    <div className="faq-item__icon">{item.icon}</div>
                    <div>
                      <div className="faq-item__category">{item.category}</div>
                      <div className="faq-item__question">{item.question}</div>
                    </div>
                    <ChevronDown size={16} className="faq-item__chevron" />
                  </div>
                  <div className="faq-item__answer">{item.answer}</div>
                </button>
              );
            })}
          </div>
        </section>

        <InlineAiChat
          title="Ask the AI assistant"
          description="Use this for quick platform questions now. A RAG knowledge base can be plugged in later without changing the page layout."
          starterPrompts={[
            'How do I add a recovery email?',
            'What should I do if I suspect fraud?',
            'Explain the investments dashboard',
            'How do I change my accessibility settings?',
          ]}
        />
      </div>
    </div>
  );
};

export default FAQ;
