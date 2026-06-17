import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { mlAPI } from '../../api';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceCallModal: React.FC<VoiceCallModalProps> = ({ isOpen, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [transcript, setTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false); // Speaker mute
  const [isMicMuted, setIsMicMuted] = useState(false); // Microphone mute
  const [callDuration, setCallDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const timerRef = useRef<any>(null);

  const shouldStopRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      shouldStopRef.current = false;
      startCall();
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      shouldStopRef.current = true;
      endCall();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = () => {
    setStatus('Agent connected');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setStatus('Listening...');
      };

      recognition.onresult = async (event: any) => {
        if (isMicMuted) return;
        const lastResult = event.results[event.results.length - 1];
        const text = lastResult[0].transcript;
        if (lastResult.isFinal) {
          handleUserSpeech(text);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Keep listening
        } else {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (!shouldStopRef.current && !isSpeaking && !isMicMuted) {
          try {
            recognition.start();
          } catch (e) { }
        }
      };

      recognitionRef.current = recognition;
      if (!isMicMuted) recognition.start();
    }

    // Initial greeting
    speak("Hello! I am Vaulty, your Wealth Vault support agent. How can I help you today?");
  };

  const toggleMic = () => {
    const newMuted = !isMicMuted;
    setIsMicMuted(newMuted);
    if (recognitionRef.current) {
      if (newMuted) {
        recognitionRef.current.stop();
        setIsListening(false);
        setStatus('Mic muted');
      } else {
        try {
          recognitionRef.current.start();
          setStatus('Listening...');
        } catch (e) { }
      }
    }
  };

  const handleUserSpeech = async (text: string) => {
    if (!text.trim() || shouldStopRef.current) return;
    setTranscript(text);
    setStatus('Processing...');

    // Stop listening while agent is thinking/speaking
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
    setIsListening(false);

    try {
      const res = await mlAPI.voiceAgent(text);
      if (shouldStopRef.current) return;
      const responseText = res.data.response;
      speak(responseText);
    } catch (err) {
      if (shouldStopRef.current) return;
      console.error('Voice agent error:', err);
      speak("I'm sorry, I encountered an error. Could you repeat that?");
    }
  };

  const speak = (text: string) => {
    if (isMuted || shouldStopRef.current) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const voices = synthRef.current.getVoices();
    const indVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indVoice) utterance.voice = indVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatus('Agent speaking...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus(isMicMuted ? 'Mic muted' : 'Listening...');
      // Start listening again after agent finishes speaking
      if (!shouldStopRef.current && !isMicMuted && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) { }
      }
    };

    synthRef.current.speak(utterance);
  };

  const endCall = () => {
    shouldStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort(); // Use abort for immediate stop
      } catch (e) { }
    }
    synthRef.current.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDuration(0);
    setTranscript('');
    setStatus('Call ended');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 h-full">
      <div className="w-full max-w-md min-h-[480px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-xl flex flex-col items-center justify-between text-center p-6 sm:pt-12 pb-8 px-8 p-8">
        <div className="flex flex-col items-center gap-2 w-full mb-10 mt-6">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-600 to-amber-500 text-white text-2xl font-bold">
            <div className={`absolute inset-[-6px] rounded-full border-2 border-teal-500/40 ${isSpeaking ? 'animate-ping' : ''}`}></div>
            V
          </div>

          <h3 className="text-lg font-semibold mt-2">Vaulty</h3>
          <p className="text-sm text-[var(--text-muted)]">{status}</p>
          <p className="text-sm font-medium">{formatTime(callDuration)}</p>
        </div>

        <div className="call-body w-full flex-1 flex flex-col justify-center gap-6">
          <div className={`visualizer ${isListening ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          {transcript && (
            <div className="user-transcript max-h-[80px] overflow-y-auto">
              <p>"{transcript}"</p>
            </div>
          )}
        </div>

        <div className="call-controls w-full flex items-center justify-center gap-6 pt-4">
          <button
            className={`call-btn ${isMuted ? 'active' : ''}`}
            onClick={() => {
              const newState = !isMuted;
              setIsMuted(newState);
              if (newState) synthRef.current.cancel();
            }}
            title={isMuted ? "Unmute speaker" : "Mute speaker"}
          >
            {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>

          <button className="call-btn end-call" onClick={onClose} title="End call">
            <PhoneOff size={28} />
          </button>

          <button
            className={`call-btn ${isMicMuted ? 'active' : ''}`}
            onClick={toggleMic}
            title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCallModal;
