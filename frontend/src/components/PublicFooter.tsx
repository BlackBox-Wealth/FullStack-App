import React from 'react';

const PublicFooter: React.FC = () => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '24px 20px',
      marginTop: '40px',
      borderTop: '1px solid var(--border-color)',
      color: 'var(--text-muted)',
      fontSize: '0.85rem'
    }}>
      <p style={{ margin: '4px 0', fontWeight: 600, color: 'var(--text-secondary)' }}>
        © 2026 WealthVault. All rights reserved.
      </p>
      <p style={{ margin: '4px 0' }}>
        Securing your wealth, powering your future.
      </p>
    </footer>
  );
};

export default PublicFooter;
