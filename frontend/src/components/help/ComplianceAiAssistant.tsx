import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Send,
  Volume2,
  VolumeX,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  PhoneCall,
  Info
} from 'lucide-react';
import { complianceAPI } from '../../api';

interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
  source?: string;
  status?: string;
  explanation?: string;
  isVoice?: boolean;
}

interface ComplianceAiAssistantProps {
  onStartCall?: () => void;
}

const ComplianceAiAssistant: React.FC<ComplianceAiAssistantProps> = ({ onStartCall }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'ai',
      text: 'Hello! I am your Punjab & Sind Bank Compliance Assistant. You can ask me about KYC policies, RBI regulations, or transaction limits. You can type or use the microphone for voice support.',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Optimized for Indian English

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Automatically send the message if there's text after a short delay to ensure last results are processed
        setTimeout(() => {
          const currentText = (document.getElementById('compliance-input') as HTMLTextAreaElement)?.value || '';
          if (currentText.trim()) {
            handleSendText(currentText, true);
          }
        }, 300);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const speakText = (text: string) => {
    if (isMuted) return;

    // Stop any current speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find an Indian English voice
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indVoice) utterance.voice = indVoice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  const handleSendText = async (overrideText?: string, wasVoice: boolean = false) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: textToSend,
      isVoice: wasVoice,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Reset textarea height
    const textarea = document.getElementById('compliance-input') as HTMLTextAreaElement;
    if (textarea) textarea.style.height = 'auto';

    setIsLoading(true);

    try {
      const response = await complianceAPI.query(textToSend);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: response.data.answer,
        source: response.data.source,
        status: response.data.compliance_status,
        explanation: response.data.compliance_explanation,
      };
      setMessages(prev => [...prev, aiMsg]);

      // Auto-speak if it was a voice query
      if (wasVoice) {
        speakText(response.data.answer);
      }
    } catch (error) {
      console.error('Compliance query failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Warm up voices
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    // Auto-grow textarea
    const textarea = document.getElementById('compliance-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition already started');
      }
    } else {
      alert('Speech recognition is not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const lower = status.toLowerCase();
    if (lower === 'compliant') return <span className="badge badge--success"><ShieldCheck size={12} /> Compliant</span>;
    if (lower === 'non-compliant') return <span className="badge badge--danger"><AlertCircle size={12} /> Non-Compliant</span>;
    if (lower === 'risky') return <span className="badge badge--warning"><AlertCircle size={12} /> Risky</span>;
    return <span className="badge badge--neutral"><HelpCircle size={12} /> Query</span>;
  };

  return (
    <div className="compliance-assistant card">
      <div className="section-heading">
        <div>
          <div className="section-heading__eyebrow">Smart Support</div>
          <h2>Regulatory Expert</h2>
        </div>
        <div className="assistant-controls">
          <button
            className={`control-btn ${isMuted ? 'muted' : ''} h-8 w-8`}
            onClick={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              if (newMuted) window.speechSynthesis.cancel();
            }}
            title={isMuted ? "Unmute AI voice" : "Mute AI voice"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="control-btn"
            title="Call AI Support Bot"
            onClick={onStartCall}
          >
            <PhoneCall size={18} />
          </button>
        </div>
      </div>

      <div className="chat-viewport" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message--${msg.type}`}>
            <div className="chat-message__bubble">
              {msg.type === 'ai' && (
                <div className="ai-meta">
                  <div style={{ display: 'flex', flex: 1, gap: 10, alignItems: 'center' }}>
                    {getStatusBadge(msg.status)}
                    {msg.source && <span className="source-tag"><Info size={10} /> {msg.source}</span>}
                  </div>
                  <button
                    className="speak-msg-btn"
                    onClick={() => speakText(msg.text)}
                    title="Read answer aloud"
                  >
                    <Volume2 size={14} />
                  </button>
                </div>
              )}
              <div className="chat-message__text">
                {msg.isVoice && <Mic size={12} className="voice-indicator" />}
                {msg.text}
              </div>
              {msg.explanation && (
                <div className="compliance-explanation">
                  <p>{msg.explanation}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message chat-message--ai loading">
            <div className="chat-message__bubble">
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {isRecording ? (
          <div className="recording-status">
            <div className="pulse-circle"></div>
            <span className="timer">{formatTime(recordingTime)}</span>
            <span className="status-text">Listening to your question...</span>
            <button className="stop-btn" onClick={stopRecording}>
              <Square size={20} fill="currentColor" />
            </button>
          </div>
        ) : (
          <>
            <div className="text-input-wrapper">
              <textarea
                id="compliance-input"
                placeholder="Ask about KYC, AML, or bank policies..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                disabled={isLoading}
                rows={1}
              />
              <button className="send-btn" onClick={() => handleSendText()} disabled={!inputText.trim() || isLoading}>
                <Send size={18} />
              </button>
            </div>
            <button className="mic-btn" onClick={startRecording} disabled={isLoading}>
              <Mic size={20} />
            </button>
          </>
        )}
      </div>

      <div className="assistant-footer">
        <p>Powered by Punjab & Sind Bank Compliance RAG Engine</p>
      </div>
    </div>
  );
};

export default ComplianceAiAssistant;
