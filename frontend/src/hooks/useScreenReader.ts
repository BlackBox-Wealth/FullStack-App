import { useEffect, useRef } from 'react';
import { useUIStore } from '../store';

// Helper to determine the semantic type of an element
const getElementType = (el: HTMLElement): string => {
  const tagName = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  
  if (role) return role;
  
  if (tagName === 'a') return 'link';
  if (tagName === 'button') return 'button';
  if (tagName === 'img') return 'image';
  if (tagName === 'input') {
    const type = el.getAttribute('type') || 'text';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio button';
    if (type === 'submit' || type === 'button') return 'button';
    return `${type} input`;
  }
  if (tagName === 'select') return 'dropdown';
  if (tagName === 'textarea') return 'text area';
  if (/^h[1-6]$/.test(tagName)) return `heading level ${tagName[1]}`;
  
  return '';
};

export const useScreenReader = () => {
  const { accessibility } = useUIStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    if (!accessibility.screenReader || !synthRef.current) {
      if (synthRef.current?.speaking) synthRef.current.cancel();
      
      // Cleanup styles if deactivated
      const styleEl = document.getElementById('screen-reader-styles');
      if (styleEl) styleEl.remove();
      
      if (lastTargetRef.current) {
        lastTargetRef.current.classList.remove('sr-highlight');
        lastTargetRef.current = null;
      }
      return;
    }

    const synth = synthRef.current;

    // Inject highlight styles
    if (!document.getElementById('screen-reader-styles')) {
      const style = document.createElement('style');
      style.id = 'screen-reader-styles';
      style.textContent = `
        .sr-highlight {
          outline: 3px solid #facc15 !important;
          outline-offset: 2px !important;
          border-radius: 4px !important;
          transition: outline 0.15s ease !important;
          z-index: 10000;
        }
      `;
      document.head.appendChild(style);
    }

    const highlightElement = (el: HTMLElement) => {
      // Remove old highlight
      if (lastTargetRef.current && lastTargetRef.current !== el) {
        lastTargetRef.current.classList.remove('sr-highlight');
      }
      // Add new highlight
      el.classList.add('sr-highlight');
      lastTargetRef.current = el;
    };

    const speak = (text: string, type: string) => {
      if (!text || text.trim() === '') return;
      if (synth.speaking) synth.cancel();
      
      // Append the element type directly for the screen reader
      const fullText = type ? `${text}. ${type}` : text;
      const utterance = new SpeechSynthesisUtterance(fullText.trim());
      utterance.rate = 1.05;
      utterance.pitch = 1;
      
      // Remove highlight when finished speaking
      utterance.onend = () => {
        if (lastTargetRef.current) {
          lastTargetRef.current.classList.remove('sr-highlight');
          lastTargetRef.current = null;
        }
      };
      
      synth.speak(utterance);
    };

    const processElement = (target: HTMLElement, isHover: boolean) => {
      if (!target) return;

      // Ignore if it's the same target as before (for hover)
      if (isHover && target === lastTargetRef.current && synth.speaking) return;

      let textToRead = target.getAttribute('aria-label') || target.getAttribute('alt') || '';
      const elType = getElementType(target);

      // Extract text content if no ARIA or ALT
      if (!textToRead) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          const inputEl = target as HTMLInputElement;
          textToRead = inputEl.value || inputEl.placeholder || inputEl.name;
        } else if (target.tagName === 'SELECT') {
           const selectEl = target as HTMLSelectElement;
           textToRead = selectEl.options[selectEl.selectedIndex]?.text || '';
        } else {
           // For text nodes, avoid reading huge containers unless it's a specific tag
           const tagNamesToRead = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'A', 'LABEL', 'LI', 'TH', 'TD'];
           if (tagNamesToRead.includes(target.tagName) || elType) {
              textToRead = target.innerText || target.textContent || '';
           } else if (target.tagName === 'DIV' || target.tagName === 'SPAN') {
              // Check if it's a leaf node roughly
              if (target.children.length === 0 || target.innerText.length < 100) {
                 textToRead = target.innerText;
              }
           }
        }
      }

      if (textToRead && textToRead.length > 0 && textToRead.length < 800) {
        highlightElement(target);
        speak(textToRead, elType);
      }
    };

    const handleMouseOver = (event: MouseEvent) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      // Add a slight debounce so sweeping mouse doesn't trigger a cacophony
      hoverTimerRef.current = setTimeout(() => {
        processElement(event.target as HTMLElement, true);
      }, 400); // 400ms delay to commit to reading
    };
    
    const handleMouseOut = (event: MouseEvent) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };

    const handleFocus = (event: FocusEvent) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      processElement(event.target as HTMLElement, false);
    };

    // Attach listeners
    document.addEventListener('mouseover', handleMouseOver, { capture: true });
    document.addEventListener('mouseout', handleMouseOut, { capture: true });
    document.addEventListener('focusin', handleFocus, { capture: true });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, { capture: true });
      document.removeEventListener('mouseout', handleMouseOut, { capture: true });
      document.removeEventListener('focusin', handleFocus, { capture: true });
      
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (synth.speaking) synth.cancel();
      
      const styleEl = document.getElementById('screen-reader-styles');
      if (styleEl) styleEl.remove();
      
      if (lastTargetRef.current) {
        lastTargetRef.current.classList.remove('sr-highlight');
      }
    };
  }, [accessibility.screenReader]);
};
