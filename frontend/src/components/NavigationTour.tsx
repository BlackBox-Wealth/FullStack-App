import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, Sparkles, Navigation } from 'lucide-react';
import { useAuthStore } from '../store';
import { authAPI } from '../api';

const getSteps = (role: string = 'customer') => {
  const commonSteps = [
    {
      target: '#sidebar-nav',
      title: 'Main Navigation',
      content: 'This is your command center. Access all your core features and tools from here.',
      position: 'right'
    }
  ];

  const roleSpecificSteps = [];
  
  if (role === 'customer') {
    roleSpecificSteps.push(
      {
        target: '#section-wealth',
        title: 'Wealth Management',
        content: 'Grow your money with tailored goals, managed SIPs, and your secure Asset Vault.',
        position: 'right'
      },
      {
        target: '#section-ai',
        title: 'AI Insights',
        content: 'Experience the future of banking with AI-powered recommendations and financial simulation tools.',
        position: 'right'
      }
    );
  } else if (role === 'employee' || role === 'super_admin' || role === 'relationship_manager') {
    roleSpecificSteps.push(
      {
        target: '#section-operations',
        title: 'Internal Operations',
        content: 'Manage KYC verifications, loan approvals, and fraud alerts efficiently in this dedicated space.',
        position: 'right'
      }
    );
  }

  const headerSteps = [
    {
      target: '#header-tabs',
      title: 'Quick Access',
      content: 'Switch between your most-used views instantly using these persistent tabs.',
      position: 'bottom'
    },
    {
      target: '#theme-toggle',
      title: 'Personalize Your View',
      content: 'Cycle through our premium themes: Linen, Midnight, Sepia, Aurora, and Graphite.',
      position: 'bottom'
    },
    {
      target: '#accessibility-menu',
      title: 'Inclusive Experience',
      content: 'Enable voice navigation, screen reader support, and other accessibility features here.',
      position: 'bottom'
    },
    {
      target: '#user-menu',
      title: 'Profile & Settings',
      content: 'Manage your profile, security settings, and data privacy from your personal menu.',
      position: 'bottom'
    }
  ];

  return [...commonSteps, ...roleSpecificSteps, ...headerSteps];
};

const NavigationTour: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const tourSteps = getSteps(user?.role);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (user?.is_new_user) {
      // Small delay to ensure layout is ready
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (isVisible) {
      const updateTarget = () => {
        const element = document.querySelector(tourSteps[currentStep].target);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Delay rect update slightly to wait for scroll
          setTimeout(() => {
            setTargetRect(element.getBoundingClientRect());
          }, 400);
        }
      };
      
      updateTarget();
      window.addEventListener('resize', updateTarget);
      return () => window.removeEventListener('resize', updateTarget);
    }
  }, [isVisible, currentStep]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);
    try {
      await authAPI.updateProfile({ is_new_user: false });
      if (user) {
        updateUser({ ...user, is_new_user: false });
      }
    } catch (err) {
      console.error('Failed to update onboarding status:', err);
    }
  };

  if (!isVisible || !targetRect) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="tour-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      pointerEvents: 'none'
    }}>
      {/* Dimmed Background with Hole */}
      <svg width="100%" height="100%" style={{ pointerEvents: 'auto' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect 
              x={targetRect.left - 10} 
              y={targetRect.top - 10} 
              width={targetRect.width + 20} 
              height={targetRect.height + 20} 
              rx="12" 
              fill="black" 
            />
          </mask>
        </defs>
        <rect 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.6)" 
          mask="url(#tour-mask)" 
          onClick={handleComplete}
        />
      </svg>

      {/* Spotlight Border */}
      <motion.div
        layoutId="spotlight"
        initial={false}
        animate={{
          left: targetRect.left - 10,
          top: targetRect.top - 10,
          width: targetRect.width + 20,
          height: targetRect.height + 20,
        }}
        style={{
          position: 'absolute',
          border: '3px solid var(--accent-primary)',
          borderRadius: '14px',
          boxShadow: '0 0 20px var(--accent-primary)',
          zIndex: 2001
        }}
      />

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          left: step.position === 'right' ? targetRect.right + 25 : 
                step.position === 'bottom' ? targetRect.left + (targetRect.width / 2) - 150 : 20,
          top: step.position === 'right' ? Math.min(targetRect.top, window.innerHeight - 280) : 
               step.position === 'bottom' ? targetRect.bottom + 25 : 20,
        }}
        className="glass-premium"
        style={{
          position: 'absolute',
          width: '300px',
          padding: '24px',
          borderRadius: '20px',
          zIndex: 2002,
          pointerEvents: 'auto',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <Navigation size={18} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              WealthVault Tour • {currentStep + 1}/{tourSteps.length}
            </span>
          </div>
          <button onClick={handleComplete} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{step.title}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.content}</p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {currentStep > 0 && (
            <button 
              className="btn btn-secondary" 
              onClick={handleBack}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}
          >
            {currentStep === tourSteps.length - 1 ? 'Finish Tour' : 'Next'} <ChevronRight size={16} />
          </button>
        </div>

        {/* Tip Indicator */}
        <div style={{ position: 'absolute', top: '-10px', left: step.position === 'bottom' ? '50%' : '-10px', transform: step.position === 'bottom' ? 'translateX(-50%)' : 'none' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            background: 'var(--bg-card)', 
            borderLeft: '1px solid var(--border-color)', 
            borderTop: '1px solid var(--border-color)', 
            transform: 'rotate(45deg)' 
          }} />
        </div>
      </motion.div>
    </div>
  );
};

export default NavigationTour;
