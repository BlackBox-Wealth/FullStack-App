import React, { useRef, useEffect, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoItem {
  title: string;
  description: string;
}

interface PageInfoButtonProps {
  items: InfoItem[];
  pageTitle?: string;
}

const PageInfoButton: React.FC<PageInfoButtonProps> = ({ items, pageTitle }) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!showPopover) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showPopover]);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowPopover(false);
    }, 100);
  };

  return (
    <div
      ref={popoverRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '8px' }}
    >
      <button
        type="button"
        onClick={() => setShowPopover((prev) => !prev)}
        onMouseEnter={(e) => {
          handleMouseEnter();
          (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          handleMouseLeave();
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
        }}
        onFocus={() => setShowPopover(true)}
        aria-label={`${pageTitle || 'Page'} glossary`}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          transition: 'color 0.2s ease',
        }}
      >
        <Info size={18} />
      </button>

      {showPopover && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            width: 360,
            maxHeight: 400,
            overflowY: 'auto',
            zIndex: 3000,
            padding: '16px',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {pageTitle && (
            <strong
              style={{
                color: 'var(--text-primary)',
                display: 'block',
                marginBottom: 12,
                fontSize: '0.95rem',
              }}
            >
              {pageTitle} Glossary
            </strong>
          )}

          {items.map((item, idx) => (
            <div key={idx} style={{ marginBottom: idx < items.length - 1 ? 14 : 0 }}>
              <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: 4 }}>
                {item.title}
              </strong>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageInfoButton;
