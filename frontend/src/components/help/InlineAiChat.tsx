import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { mlAPI } from '../../api';

interface InlineAiChatProps {
  title: string;
  description: string;
  starterPrompts: string[];
}

const InlineAiChat: React.FC<InlineAiChatProps> = ({ title, description, starterPrompts }) => {
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'assistant' }[]>([
    {
      text: 'I can answer general WealthVault questions, help with account steps, and explain support options. A RAG-powered assistant will plug in here later.',
      sender: 'assistant',
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const starterList = useMemo(() => starterPrompts.slice(0, 4), [starterPrompts]);

  const sendPrompt = async (text: string) => {
    const nextPrompt = text.trim();
    if (!nextPrompt || loading) return;

    setMessages((current) => [...current, { text: nextPrompt, sender: 'user' }]);
    setLoading(true);
    setPrompt('');

    try {
      const response = await mlAPI.chatbot(nextPrompt);
      setMessages((current) => [
        ...current,
        { text: response.data.response || 'I could not generate an answer right now.', sender: 'assistant' },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { text: 'The support assistant is unavailable right now. Please try again.', sender: 'assistant' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="help-chat card">
      <div className="help-chat__header">
        <div>
          <div className="help-chat__eyebrow">
            <Sparkles size={14} /> AI support
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="help-chat__prompts">
        {starterList.map((starter) => (
          <button
            key={starter}
            type="button"
            className="help-chat__chip"
            onClick={() => sendPrompt(starter)}
            disabled={loading}
          >
            {starter}
          </button>
        ))}
      </div>

      <div className="help-chat__messages">
        {messages.map((message, index) => (
          <div key={`${message.sender}-${index}`} className={`help-chat__message ${message.sender}`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="help-chat__message assistant help-chat__message--loading">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="help-chat__composer">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask the WealthVault assistant"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void sendPrompt(prompt);
            }
          }}
        />
        <button type="button" onClick={() => void sendPrompt(prompt)} disabled={loading || !prompt.trim()}>
          <Send size={16} />
        </button>
      </div>
    </section>
  );
};

export default InlineAiChat;
