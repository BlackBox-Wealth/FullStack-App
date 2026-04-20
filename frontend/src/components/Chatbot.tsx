import React, { useState, useRef, useEffect } from 'react';
import { mlAPI } from '../api';
import { useAuthStore } from '../store';

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([
    { text: "Hello! I'm your WealthVault AI advisor. Ask me about investments, savings, budgeting, or loans!", sender: 'bot' },
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
      setMessages((prev) => [...prev, { text: res.data.response, sender: 'bot' }]);
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
            <h3>🤖 WealthVault AI</h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.sender}`}>
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
              ➤
            </button>
          </div>
        </div>
      )}
      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)} id="chatbot-toggle">
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  );
};

export default Chatbot;
