import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSend, FiBook, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { agentsAPI } from '../api';
import PageInfoButton from '../components/PageInfoButton';
import { useAuthStore } from '../store';
import ReactMarkdown from 'react-markdown';

const AIAgents: React.FC = () => {
  const { user } = useAuthStore();
  const userLanguage = user?.language || 'en';
  
  const [activeTab, setActiveTab] = useState<'advisor' | 'teacher'>('advisor');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState('');
  const [lessons, setLessons] = useState<Array<{ topic: string; content: string }>>([]);
  const [userQuery, setUserQuery] = useState('');

  const [userProfile] = useState({
    balance: 150000,
    monthly_income: 75000,
    monthly_expenses: 25000,
    savings_rate: 0.60,
    investment_portfolio: ['mutual_funds', 'stocks'],
    credit_score: 750,
    loan_balance: 0,
    age: 32,
    job_type: 'salaried'
  });

  const handleGetAdvice = async () => {
    if (!userQuery.trim()) {
      toast.error('Please enter your question');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_query: userQuery,
        language: userLanguage
      };

      const response = await agentsAPI.getAdvisorAdvice(payload);
      
      if (response.data?.status === 'success') {
        setAdvice(response.data.advisor_response);
        toast.success('Advice generated successfully!');
      } else {
        toast.error('Failed to generate advice');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error getting advice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLessons = async () => {
    setLoading(true);
    try {
      const response = await agentsAPI.getDailyLessons({ language: userLanguage });
      
      if (response.data?.status === 'success') {
        setLessons(response.data.lessons || []);
        toast.success('Daily lessons generated!');
      } else {
        toast.error('Failed to generate lessons');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error getting lessons. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="ai-agents-page"
    >
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
            AI Agents: Financial Intelligence
            <PageInfoButton
              pageTitle="AI Agents"
              items={[
                { title: 'Wealth Advisor', description: 'AI-powered personal finance advisor that analyzes your profile and provides personalized investment, tax, and wealth management strategies.' },
                { title: 'Wealth Teacher', description: 'Daily micro-lessons on financial literacy, fraud awareness, credit management, and economic principles tailored to your activity.' },
                { title: 'PII Protection', description: 'All data is anonymized before being sent to AI models, ensuring your personal information remains secure and private.' }
              ]}
            />
          </h2>
          <p>Get personalized financial advice and daily learning lessons powered by AI. Market-based analysis can be used for growth predictions by SMEs, evaluating loans, and mitigating losses.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        <button
          onClick={() => setActiveTab('advisor')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'advisor' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'advisor' ? '#fff' : 'var(--text-secondary)',
            borderRadius: 'var(--border-radius-md)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          <FiTrendingUp style={{ marginRight: 8, display: 'inline' }} />
          Wealth Advisor
        </button>
        <button
          onClick={() => setActiveTab('teacher')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'teacher' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'teacher' ? '#fff' : 'var(--text-secondary)',
            borderRadius: 'var(--border-radius-md)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          <FiBook style={{ marginRight: 8, display: 'inline' }} />
          Daily Lessons
        </button>
      </div>

      {/* Wealth Advisor Tab */}
      {activeTab === 'advisor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Input Section */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Get Financial Advice</h3>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
                Your Financial Question
              </label>
              <textarea
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="E.g., Should I invest more in mutual funds or real estate? How can I save on taxes?"
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: 12,
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                <strong>Your Profile (Anonymized):</strong>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
                <div>Balance: ₹{userProfile.balance.toLocaleString()}</div>
                <div>Monthly Income: ₹{userProfile.monthly_income.toLocaleString()}</div>
                <div>Credit Score: {userProfile.credit_score}</div>
                <div>Age: {userProfile.age} years</div>
              </div>
            </div>

            <button
              onClick={handleGetAdvice}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: loading ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <FiSend size={16} />
              {loading ? 'Generating Advice...' : 'Get Advice'}
            </button>
          </div>

          {/* Advice Output Section */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">AI Advisor Response</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 6, padding: '4px 10px', margin: '6px 0 0', display: 'inline-block', fontWeight: 500 }}>
                  Disclaimer: This is an AI adviser that gives personalised financial advice. It won't give definite answers (yes/no) — invest at your own risk.
                </p>
              </div>
            </div>

            {advice ? (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <div style={{
                  padding: 12,
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                  lineHeight: 1.8,
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  wordBreak: 'break-word'
                }} className="markdown-content">
                  <ReactMarkdown>{advice}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
              }}>
                <FiAlertCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p>Ask a question to get personalized financial advice</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Lessons Tab */}
      {activeTab === 'teacher' && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={handleGetLessons}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: loading ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FiBook size={16} />
              {loading ? 'Generating Lessons...' : 'Generate Today\'s Lessons'}
            </button>
          </div>

          {lessons.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {lessons.map((lesson, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8
                  }}>
                    {lesson.topic}
                  </div>
                  <div style={{
                    margin: 0,
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6
                  }} className="markdown-content">
                    <ReactMarkdown>{lesson.content}</ReactMarkdown>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <FiBook size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Click "Generate Today's Lessons" to receive personalized financial education
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AIAgents;
