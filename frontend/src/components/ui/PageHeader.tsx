import React from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, action }) => {
  return (
    <div className="page-hero">
      <div>
        {eyebrow && <div className="page-hero__eyebrow">{eyebrow}</div>}
        <h1 className="page-hero__title">{title}</h1>
        <p className="page-hero__description">{description}</p>
      </div>
      {action && <div className="page-hero__action">{action}</div>}
    </div>
  );
};

export default PageHeader;
