import { useState, useEffect, useRef, useCallback } from 'react';

export interface BiometricData {
  tap_pressure: number;
  tap_duration_ms: number;
  finger_area_px: number;
  scroll_velocity_px_s: number;
  scroll_acceleration: number;
  keystroke_interval_ms: number;
  error_rate: number;
  nav_time_per_screen_s: number;
  session_entropy: number;
  hesitation_events: number;
  copy_paste_detected: number;
  tab_switch_count: number;
}

export const useBiometrics = () => {
  const [data, setData] = useState<BiometricData>({
    tap_pressure: 0.5,
    tap_duration_ms: 0,
    finger_area_px: 20,
    scroll_velocity_px_s: 0,
    scroll_acceleration: 0,
    keystroke_interval_ms: 0,
    error_rate: 0,
    nav_time_per_screen_s: 0,
    session_entropy: 0,
    hesitation_events: 0,
    copy_paste_detected: 0,
    tab_switch_count: 0,
  });

  // Refs for values read in event callbacks — avoids stale closures and
  // prevents handlers from being recreated (and listeners re-registered) on every keystroke.
  // Initialized to 0; set to Date.now() inside the effect to satisfy react-hooks/purity.
  const lastKeystrokeRef = useRef<number | null>(null); // null until first key
  const lastScrollPosRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const keystrokeCountRef = useRef<number>(0);
  const backspaceCountRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const now = Date.now();
    keystrokeCountRef.current += 1;
    if (e.key === 'Backspace') backspaceCountRef.current += 1;

    const errorRate = backspaceCountRef.current / keystrokeCountRef.current;

    if (lastKeystrokeRef.current !== null) {
      const interval = now - lastKeystrokeRef.current;
      setData(prev => ({
        ...prev,
        // EWMA (80/20) so recent typing speed matters more than the historical average
        keystroke_interval_ms:
          prev.keystroke_interval_ms === 0 ? interval : prev.keystroke_interval_ms * 0.8 + interval * 0.2,
        error_rate: errorRate,
        session_entropy: Math.min(1.0, prev.session_entropy + 0.01),
        hesitation_events: interval > 2000 ? prev.hesitation_events + 1 : prev.hesitation_events,
      }));
    } else {
      setData(prev => ({
        ...prev,
        error_rate: errorRate,
        session_entropy: Math.min(1.0, prev.session_entropy + 0.01),
      }));
    }

    lastKeystrokeRef.current = now;
  }, []); // stable — uses refs, never recreated

  const handleScroll = useCallback(() => {
    const now = Date.now();
    const pos = window.scrollY;
    const timeDiff = (now - lastScrollTimeRef.current) / 1000;
    const dist = Math.abs(pos - lastScrollPosRef.current);

    if (timeDiff > 0 && dist > 0) {
      const velocity = dist / timeDiff;
      setData(prev => ({
        ...prev,
        scroll_velocity_px_s:
          prev.scroll_velocity_px_s === 0 ? velocity : (prev.scroll_velocity_px_s + velocity) / 2,
        scroll_acceleration: Math.abs(velocity - prev.scroll_velocity_px_s) / timeDiff,
      }));
    }

    lastScrollPosRef.current = pos;
    lastScrollTimeRef.current = now;
  }, []); // stable

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const start = Date.now();
    // pressure === 0 means the PointerEvent pressure API is unsupported (most desktops)
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const area = e.width > 0 && e.height > 0 ? e.width * e.height : 20;

    const onPointerUp = () => {
      const duration = Date.now() - start;
      setData(prev => ({
        ...prev,
        tap_pressure: (prev.tap_pressure + pressure) / 2,
        tap_duration_ms: prev.tap_duration_ms === 0 ? duration : (prev.tap_duration_ms + duration) / 2,
        finger_area_px: (prev.finger_area_px + area) / 2,
      }));
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointerup', onPointerUp);
  }, []); // stable

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setData(prev => ({ ...prev, tab_switch_count: prev.tab_switch_count + 1 }));
    }
  }, []); // stable

  const handleCopyPaste = useCallback(() => {
    setData(prev => ({ ...prev, copy_paste_detected: 1 }));
  }, []); // stable

  useEffect(() => {
    // Set time-based refs here so Date.now() is called after mount, not during render
    const now = Date.now();
    lastScrollTimeRef.current = now;
    startTimeRef.current = now;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('copy', handleCopyPaste);
    window.addEventListener('paste', handleCopyPaste);

    // Update nav_time every second so submit always has a fresh value
    const navTimer = setInterval(() => {
      setData(prev => ({
        ...prev,
        nav_time_per_screen_s: (Date.now() - startTimeRef.current) / 1000,
      }));
    }, 1000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('copy', handleCopyPaste);
      window.removeEventListener('paste', handleCopyPaste);
      clearInterval(navTimer);
    };
  }, [handleKeyDown, handlePointerDown, handleScroll, handleVisibilityChange, handleCopyPaste]);

  return data;
};
