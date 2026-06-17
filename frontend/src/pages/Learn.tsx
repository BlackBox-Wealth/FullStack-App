import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  ShieldAlert, 
  TrendingUp, 
  PiggyBank, 
  CreditCard, 
  GraduationCap, 
  Search, 
  ChevronRight, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Target,
  AlertTriangle,
  Lightbulb,
  Lock,
  ArrowUpRight,
  MousePointer2
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface LearningCard {
  id: string;
  category: 'investments' | 'frauds' | 'literacy' | 'loans';
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
    category: 'investments',
    title: 'Mutual Funds 101',
    description: 'Pool your money with others to invest in a diversified portfolio managed by pros.',
    icon: <TrendingUp size={24} />,
    color: '#0f766e',
    content: [
      'Diversification: Spreads risk across multiple assets.',
      'Professional Management: Handled by experienced fund managers.',
      'Liquidity: Most funds allow you to withdraw anytime.',
      'Systematic Investment: Start small with monthly SIPs.'
    ],
    tips: ['Check the Expense Ratio before investing.', 'Align your choice with your risk appetite.']
  },
  {
    id: 'phishing-alert',
    category: 'frauds',
    title: 'Spotting Phishing',
    description: 'Learn how to identify fake emails, SMS, and websites designed to steal your data.',
    icon: <ShieldAlert size={24} />,
    color: '#dc2626',
    content: [
      'Urgency: Fraudsters use panic to make you act fast.',
      'Suspicious Links: Always hover over links to see the real URL.',
      'Generic Greetings: Banks usually address you by name.',
      'Request for Sensitive Data: Banks NEVER ask for PIN or OTP.'
    ],
    tips: ['Look for "https" and the padlock icon.', 'Never share OTP even with "bank officials".']
  },
  {
    id: 'compounding',
    category: 'literacy',
    title: 'Power of Compounding',
    description: 'The "Eighth Wonder of the World" — how small savings grow into massive wealth.',
    icon: <Zap size={24} />,
    color: '#ca8a04',
    content: [
      'Time is Money: Starting early is more important than the amount.',
      'Reinvestment: Earning interest on your interest.',
      'Patience: Real growth happens in the later years.',
      'Consistency: Regular contributions amplify the effect.'
    ],
    tips: ['Start an SIP today, even if it is just ₹500.', 'Reinvest dividends to maximize growth.']
  },
  {
    id: 'loan-logic',
    category: 'loans',
    title: 'Understanding Loans',
    description: 'Smart ways to borrow and manage debt without falling into a trap.',
    icon: <CreditCard size={24} />,
    color: '#2563eb',
    content: [
      'Interest Rates: Fixed vs. Floating rates explained.',
      'Tenure: Longer tenure means lower EMI but higher total interest.',
      'Credit Score: A good score helps you get lower interest rates.',
      'Pre-payment: Reducing your principal early saves a lot of money.'
    ],
    tips: ['Keep your EMI under 30% of your take-home pay.', 'Read the fine print for hidden charges.']
  },
  {
    id: 'equity-edge',
    category: 'investments',
    title: 'Stock Market Basics',
    description: 'Investing in companies to participate in their growth and profits.',
    icon: <Target size={24} />,
    color: '#0d9488',
    content: [
      'Stocks: Buying a small part of a company.',
      'Dividends: A share of company profits paid to you.',
      'Long-term Wealth: Equities historically outperform other assets.',
      'Market Volatility: Prices fluctuate; stay invested for the long run.'
    ],
    tips: ['Invest in businesses you understand.', 'Do not try to "time" the market.']
  },
  {
    id: 'otp-scams',
    category: 'frauds',
    title: 'OTP & SIM Swapping',
    description: 'How scammers hijack your phone number to access your bank accounts.',
    icon: <Lock size={24} />,
    color: '#991b1b',
    content: [
      'SIM Swap: Scammers block your SIM and issue a new one.',
      'OTP Theft: Tricking you into sharing the verification code.',
      'Remote Access Apps: Apps like AnyDesk can give scammers control.',
      'Screen Sharing: Never share your screen with strangers.'
    ],
    tips: ['Immediately contact your bank if your SIM stops working.', 'Disable "Screen Mirroring" when doing banking.']
  },
  {
    id: 'budgeting-rule',
    category: 'literacy',
    title: 'The 50/30/20 Rule',
    description: 'A simple framework to manage your monthly income effectively.',
    icon: <PiggyBank size={24} />,
    color: '#b45309',
    content: [
      '50% Needs: Rent, groceries, utilities, and bills.',
      '30% Wants: Dining out, hobbies, and entertainment.',
      '20% Savings: SIPs, emergency fund, and debt repayment.',
      'Flexibility: Adjust based on your current financial goal.'
    ],
    tips: ['Automate your 20% savings at the start of the month.', 'Track expenses using a simple app.']
  },
  {
    id: 'sip-strategy',
    category: 'loans',
    title: 'SIP Advantage',
    description: 'Why Systematic Investment Plans are better than lump-sum for most.',
    icon: <ArrowUpRight size={24} />,
    color: '#1d4ed8',
    content: [
      'Rupee Cost Averaging: Buy more units when prices are low.',
      'Discipline: Regular investing makes you a disciplined saver.',
      'Compounding: Regular small amounts lead to huge wealth.',
      'Flexibility: Stop, pause, or increase your SIP anytime.'
    ],
    tips: ['Increase your SIP amount every year (Step-up SIP).', 'Set the date right after your salary day.']
  }
];

const Learn: React.FC = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<LearningCard | null>(null);

  const categories = [
    { id: 'all', label: 'All Topics', icon: <BookOpen size={16} /> },
    { id: 'investments', label: 'Investments', icon: <TrendingUp size={16} /> },
    { id: 'frauds', label: 'Fraud Guard', icon: <ShieldAlert size={16} /> },
    { id: 'literacy', label: 'Literacy', icon: <GraduationCap size={16} /> },
    { id: 'loans', label: 'Loans & SIPs', icon: <CreditCard size={16} /> }
  ];

  const filteredData = learningData.filter(item => {
    const matchesFilter = filter === 'all' || item.category === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="learn-page">
      <div className="learn-hero">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-content"
        >
          <span className="hero-kicker">Knowledge is Wealth</span>
          <h1>Financial Learning Hub</h1>
          <p>Master your money, protect your assets, and build a secure future with our interactive guides.</p>
        </motion.div>
        
        <div className="learn-search-container">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder="Search for topics like 'compounding' or 'scams'..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="learn-filters">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-btn ${filter === cat.id ? 'active' : ''}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <motion.div 
        layout
        className="learn-grid"
      >
        <AnimatePresence mode="popLayout">
          {filteredData.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -5 }}
              className={`learn-card ${item.category}`}
              onClick={() => setSelectedCard(item)}
            >
              <div className="card-icon-wrapper" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                {item.icon}
              </div>
              <div className="card-badge" style={{ color: item.color }}>{item.category}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="card-footer">
                <span className="read-more">Learn More <ChevronRight size={14} /></span>
                <MousePointer2 className="click-indicator" size={14} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selectedCard && (
          <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="learn-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setSelectedCard(null)}>&times;</button>
              
              <div className="modal-header">
                <div className="header-icon" style={{ backgroundColor: `${selectedCard.color}15`, color: selectedCard.color }}>
                  {selectedCard.icon}
                </div>
                <div>
                  <div className="modal-category" style={{ color: selectedCard.color }}>{selectedCard.category.toUpperCase()}</div>
                  <h2>{selectedCard.title}</h2>
                </div>
              </div>

              <div className="modal-body">
                <p className="main-desc">{selectedCard.description}</p>
                
                <div className="content-section">
                  <h4>Key Insights</h4>
                  <ul>
                    {selectedCard.content.map((point, idx) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx}
                      >
                        <ShieldCheck size={16} className="bullet-icon" />
                        {point}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div className="tips-section">
                  <h4><Lightbulb size={18} /> Pro Tips</h4>
                  <div className="tips-grid">
                    {selectedCard.tips.map((tip, idx) => (
                      <div key={idx} className="tip-card">
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="action-btn primary" onClick={() => setSelectedCard(null)}>Got it!</button>
                <button className="action-btn secondary">
                  Full Guide <ExternalLink size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="learn-footer-cta">
        <div className="cta-card">
          <div className="cta-icon">
            <AlertTriangle size={32} />
          </div>
          <div className="cta-content">
            <h3>Suspect a Fraud?</h3>
            <p>If you've noticed suspicious activity or shared sensitive info, report it immediately to our security team.</p>
          </div>
          <button className="cta-btn danger">Report Incident</button>
        </div>
      </div>

      <style>{`
        .learn-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .learn-hero {
          text-align: center;
          padding: 40px 0 60px;
          position: relative;
        }

        .hero-kicker {
          display: inline-block;
          padding: 6px 16px;
          background: var(--accent-primary-hover);
          color: white;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .learn-hero h1 {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 16px;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .learn-hero p {
          font-size: 1.1rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto 40px;
        }

        .learn-search-container {
          max-width: 600px;
          margin: 0 auto;
        }

        .search-box {
          display: flex;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          padding: 4px 16px;
          border-radius: 999px;
          box-shadow: var(--shadow-md);
          transition: all var(--transition-normal);
        }

        .search-box:focus-within {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 4px var(--bg-glow-a);
          transform: scale(1.02);
        }

        .search-icon {
          color: var(--text-muted);
          margin-right: 12px;
        }

        .search-box input {
          flex: 1;
          border: none;
          background: transparent;
          padding: 12px 0;
          font-size: 1rem;
          color: var(--text-primary);
          outline: none;
        }

        .learn-filters {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-normal);
        }

        .filter-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--text-muted);
        }

        .filter-btn.active {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
          box-shadow: var(--shadow-sm);
        }

        .learn-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 60px;
        }

        .learn-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .learn-card:hover {
          border-color: var(--accent-primary);
          box-shadow: var(--shadow-lg);
          background: var(--bg-card-hover);
        }

        .card-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .card-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .learn-card h3 {
          font-size: 1.25rem;
          margin-bottom: 12px;
          color: var(--text-primary);
        }

        .learn-card p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 20px;
          flex: 1;
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .read-more {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .click-indicator {
          color: var(--text-muted);
          opacity: 0;
          transform: translateX(-10px);
          transition: all 0.3s ease;
        }

        .learn-card:hover .click-indicator {
          opacity: 1;
          transform: translateX(0);
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .learn-modal {
          background: var(--bg-card);
          width: 100%;
          max-width: 650px;
          border-radius: 28px;
          border: 1px solid var(--border-color);
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }

        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: none;
          color: var(--text-secondary);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .modal-header {
          padding: 40px 40px 20px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-category {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.15em;
          margin-bottom: 4px;
        }

        .modal-header h2 {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .modal-body {
          padding: 0 40px 40px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .main-desc {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin-bottom: 32px;
          line-height: 1.6;
        }

        .content-section h4, .tips-section h4 {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 16px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .content-section ul {
          list-style: none;
          margin-bottom: 32px;
        }

        .content-section li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 12px;
          margin-bottom: 10px;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .bullet-icon {
          color: var(--success);
          margin-top: 3px;
          flex-shrink: 0;
        }

        .tips-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .tip-card {
          padding: 16px;
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-radius: 16px;
          font-size: 0.85rem;
          color: #92400e;
          font-weight: 500;
        }

        [data-theme='midnight'] .tip-card {
          background: rgba(251, 191, 36, 0.05);
          border-color: rgba(251, 191, 36, 0.1);
          color: #fcd34d;
        }

        .modal-footer {
          padding: 24px 40px;
          background: var(--bg-secondary);
          display: flex;
          gap: 12px;
          border-top: 1px solid var(--border-color);
        }

        .action-btn {
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
        }

        .action-btn.primary {
          background: var(--accent-primary);
          color: white;
          border: none;
          flex: 1;
          justify-content: center;
        }

        .action-btn.secondary {
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .learn-footer-cta {
          margin-top: 40px;
        }

        .cta-card {
          background: linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%);
          border-radius: 24px;
          padding: 40px;
          display: flex;
          align-items: center;
          gap: 32px;
          color: white;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }

        .cta-icon {
          width: 80px;
          height: 80px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fecaca;
        }

        .cta-content {
          flex: 1;
        }

        .cta-content h3 {
          font-size: 1.75rem;
          margin-bottom: 8px;
        }

        .cta-content p {
          color: #fecaca;
          font-size: 1.1rem;
        }

        .cta-btn.danger {
          background: white;
          color: #7f1d1d;
          border: none;
          padding: 16px 32px;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cta-btn.danger:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }

        @media (max-width: 768px) {
          .cta-card {
            flex-direction: column;
            text-align: center;
            padding: 30px;
          }
          
          .tips-grid {
            grid-template-columns: 1fr;
          }
          
          .learn-hero h1 {
            font-size: 2.2rem;
          }
          
          .modal-header h2 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Learn;
