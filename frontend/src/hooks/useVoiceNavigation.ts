import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Define SpeechRecognition types since they're not in lib.dom.d.ts by default
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const useVoiceNavigation = (isActive: boolean) => {
  const navigate = useNavigate();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      if (isActive) {
        toast.error('Voice navigation is not supported in this browser.');
      }
      return;
    }

    if (!isActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();
      
      console.log('Voice Command:', transcript);
      
      if (transcript.includes('go to dashboard') || transcript.includes('home')) {
        navigate('/dashboard');
        toast.success('Navigating to Dashboard');
      } else if (transcript.includes('go to accounts') || transcript.includes('show accounts')) {
        navigate('/accounts');
        toast.success('Navigating to Accounts');
      } else if (transcript.includes('go to transactions') || transcript.includes('show transactions')) {
        navigate('/transactions');
        toast.success('Navigating to Transactions');
      } else if (transcript.includes('go to payments') || transcript.includes('make a payment')) {
        navigate('/payments');
        toast.success('Navigating to Payments');
      } else if (transcript.includes('go to investments')) {
        navigate('/investments');
        toast.success('Navigating to Investments');
      } else if (transcript.includes('go to settings')) {
        navigate('/settings');
        toast.success('Navigating to Settings');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Voice navigation disabled.');
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      toast.success('Voice navigation activated. Try saying "go to settings".');
    } catch (e) {
      console.error('Recognition already started');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isActive, navigate]);
};

export default useVoiceNavigation;
