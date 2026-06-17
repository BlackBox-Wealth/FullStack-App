import React, { useState, useRef, useEffect } from 'react';
import { mlAPI } from '../api';
import { useAuthStore } from '../store';
import { Bot, MessageSquare, Send, ShieldAlert, X } from 'lucide-react';

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot'; isUrgent?: boolean }[]>([
    { text: "Hello! I'm WealthBuddy, your AI financial advisor. I can help you with spending insights, investment advice, budgeting tips, and more. Ask me anything!", sender: 'bot' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isAuthenticated) return null;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { text: userMsg, sender: 'user' }]);
    setLoading(true);

    try {
      const res = await mlAPI.chatbot(userMsg);
      const { response, chat_stress_language } = res.data;
      
      setMessages((prev) => [...prev, { text: response, sender: 'bot' }]);
      
      if (chat_stress_language === 1) {
        setMessages((prev) => [...prev, { 
          text: "SECURITY ALERT: Our AI detected signs of urgency or potential coercion in your message. If someone is forcing you to make a transfer, please contact our support or use the 'Freeze Account' button immediately.", 
          sender: 'bot',
          isUrgent: true 
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, { text: "Sorry, I couldn't process that. Please try again.", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="chatbot-container">
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Bot size={17} /> WealthBuddy
            </h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.sender} ${msg.isUrgent ? 'urgent-alert' : ''}`}>
                {msg.isUrgent ? <ShieldAlert size={14} style={{ marginRight: 6, verticalAlign: 'text-top' }} /> : null}
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="chat-message bot" style={{ opacity: 0.6 }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
          <div className="chatbot-input">
            <input
              id="chatbot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about finances..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading} id="chatbot-send">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)} id="chatbot-toggle">
        {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
      </button>
    </div>
  );
};

export default Chatbot;
