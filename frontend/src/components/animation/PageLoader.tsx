import React from 'react';
import { Skeleton } from 'boneyard-js/react';

const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading data' }) => {
  const skeletonName = `page-loader-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const fixture = (
    <div style={{ minHeight: '56vh', display: 'grid', gap: 16, padding: 24 }}>
      <div style={{ height: 24, width: '36%', borderRadius: 10, background: 'var(--bg-secondary)' }} />
      <div style={{ height: 14, width: '52%', borderRadius: 8, background: 'var(--bg-secondary)' }} />
      <div style={{ height: 160, width: '100%', borderRadius: 16, background: 'var(--bg-secondary)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <div style={{ height: 120, borderRadius: 14, background: 'var(--bg-secondary)' }} />
        <div style={{ height: 120, borderRadius: 14, background: 'var(--bg-secondary)' }} />
        <div style={{ height: 120, borderRadius: 14, background: 'var(--bg-secondary)' }} />
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );

  return (
    <Skeleton
      name={skeletonName}
      loading
      fixture={fixture}
      fallback={fixture}
      animate="shimmer"
    >
      {fixture}
    </Skeleton>
  );
};

export default PageLoader;
