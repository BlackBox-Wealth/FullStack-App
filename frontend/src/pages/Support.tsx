import React from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, PhoneCall, Mail, MessageCircleMore, ShieldAlert, Headphones, CalendarDays } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ComplianceAiAssistant from '../components/help/ComplianceAiAssistant';
import VoiceCallModal from '../components/help/VoiceCallModal';
import BankLocator from '../components/help/BankLocator';

const supportCards = [
  {
    title: 'Emergency fraud help',
    description: 'If you think someone is pressuring you to move money, freeze the account and contact support immediately.',
    icon: <ShieldAlert size={18} />,
    tone: 'danger',
  },
  {
    title: 'Account helpdesk',
    description: 'Use this for login problems, KYC questions, device verification, or recovery setup.',
    icon: <Headphones size={18} />,
    tone: 'info',
  },
  {
    title: 'Callback request',
    description: 'Book a callback for loan, investment, or account-service questions that need a person.',
    icon: <CalendarDays size={18} />,
    tone: 'accent',
  },
];

const Support: React.FC = () => {
  const [isCallOpen, setIsCallOpen] = React.useState(false);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Help center"
        title="Support"
        description="Fast paths for urgent help, account issues, and regulatory guidance. Use our AI assistant for RAG-powered answers or call our automated support bot."
      />

      <div className="help-grid help-grid--support">
        <section className="support-panel card">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">Support paths</div>
              <h2>Choose the right route</h2>
            </div>
          </div>

          <div className="support-card-grid">
            {supportCards.map((card) => (
              <article key={card.title} className={`support-card support-card--${card.tone}`}>
                <div className="support-card__icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>

          <div className="support-contact-grid mt-6">
            <a
              className="support-contact hover:scale-[1.02] transition-transform"
              href="mailto:support@wealthvault.in"
              onClick={() => toast.success('Opening your email client...')}
            >
              <Mail size={18} /> support@wealthvault.in
            </a>
            <button
              className="support-contact hover:scale-[1.02] transition-transform w-full text-left"
              onClick={() => setIsCallOpen(true)}
            >
              <PhoneCall size={18} /> Call Voice Agent
            </button>
            <div className="support-contact support-contact--static opacity-80">
              <MessageCircleMore size={18} /> Live chat via AI assistant on this page
            </div>
          </div>

          <div className="support-note">
            <AlertTriangle size={16} />
            If this is a suspected fraud incident, use the emergency support route immediately instead of waiting for a callback.
          </div>
        </section>

        <ComplianceAiAssistant onStartCall={() => setIsCallOpen(true)} />
      </div>

      <section className="bank-locator-section card-stack">
        <div className="section-heading">
          <div>
            <div className="section-heading__eyebrow">Visit Us</div>
            <h2>Branch & ATM Locator</h2>
          </div>
        </div>
        <BankLocator />
      </section>

      <section className="support-steps card">
        <div className="section-heading">
          <div>
            <div className="section-heading__eyebrow">What to expect</div>
            <h2>Support flow</h2>
          </div>
        </div>
        <div className="support-steps__grid">
          <div>
            <div className="support-step__number">1</div>
            <h3>Describe the issue</h3>
            <p>Use plain language. The assistant and support team both respond better when you explain the goal, not just the symptom.</p>
          </div>
          <div>
            <div className="support-step__number">2</div>
            <h3>Get the fastest route</h3>
            <p>Some issues are self-service, some should go to the helpdesk, and urgent ones should be escalated immediately.</p>
          </div>
          <div>
            <div className="support-step__number">3</div>
            <h3>Follow up safely</h3>
            <p>The app will surface the next step in-context so you do not need to bounce across unrelated screens.</p>
          </div>
        </div>
      </section>
      <VoiceCallModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
      />
    </div>
  );
};

export default Support;