import React, { useEffect } from 'react';
import { useUIStore } from '../../store';

const PreferenceApplier: React.FC = () => {
  const { themeMode, accessibility } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.dataset.theme = themeMode;
    root.dataset.motion = accessibility.reducedMotion ? 'reduce' : 'full';
    root.dataset.contrast = accessibility.highContrast ? 'high' : 'normal';
    root.dataset.density = accessibility.compactDensity ? 'compact' : 'comfortable';
    body.dataset.theme = root.dataset.theme;
    body.dataset.motion = root.dataset.motion;
    body.dataset.contrast = root.dataset.contrast;
    body.dataset.density = root.dataset.density;
    root.style.setProperty('--font-scale', accessibility.largeText ? '1.18' : '1');
  }, [themeMode, accessibility]);

  return null;
};

export default PreferenceApplier;
