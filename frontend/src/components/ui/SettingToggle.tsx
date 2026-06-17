import React from 'react';

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ title, description, checked, onChange, icon }) => {
  return (
    <label className="setting-toggle">
      <div className="setting-toggle__copy">
        <div className="setting-toggle__icon">{icon}</div>
        <div>
          <div className="setting-toggle__title">{title}</div>
          <div className="setting-toggle__description">{description}</div>
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="setting-toggle__switch" aria-hidden="true" />
    </label>
  );
};

export default SettingToggle;
