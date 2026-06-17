import React, { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, Layers3, Mail, Mic, MoonStar, Palette, Phone, RotateCcw, Sparkles, SunMedium, Type, Volume2, Zap } from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import { authAPI } from '../api';
import PageHeader from '../components/ui/PageHeader';
import SettingToggle from '../components/ui/SettingToggle';
import { useTranslation } from '../hooks/useTranslation';
import { Globe } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, updateUser, setLanguage } = useAuthStore();
  const { themeMode, setThemeMode, accessibility, updateAccessibility, resetPreferences } = useUIStore();
  const { t, lang } = useTranslation();
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.recovery_email) {
      setRecoveryEmail(user.recovery_email);
    }
    if (user?.recovery_phone) {
      const phoneDisplay = user.recovery_phone.startsWith('+91')
        ? user.recovery_phone.slice(3)
        : user.recovery_phone;
      setRecoveryPhone(phoneDisplay);
    }
  }, [user]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  const themeChoices = [
    { key: 'linen', label: 'Linen', icon: <SunMedium size={16} />, copy: 'Bright editorial surface' },
    { key: 'midnight', label: 'Midnight', icon: <MoonStar size={16} />, copy: 'High-contrast dark mode' },
    { key: 'sepia', label: 'Sepia', icon: <Palette size={16} />, copy: 'Warm low-glare reading mode' },
    { key: 'aurora', label: 'Aurora', icon: <Sparkles size={16} />, copy: 'Color-rich gradient accents' },
    { key: 'graphite', label: 'Graphite', icon: <Layers3 size={16} />, copy: 'Neutral executive dark mode' },
  ] as const;

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await authAPI.sendRecoveryOtp({
        recovery_email: recoveryEmail || undefined,
        recovery_phone: recoveryPhone || undefined,
      });

      setOtpSent(true);
      setMessage({
        type: 'success',
        text: 'OTP sent to the selected recovery channels. Verify them to save the updates.',
      });

      if (response.data.email_otp_debug || response.data.phone_otp_debug) {
        console.log('Email OTP:', response.data.email_otp_debug);
        console.log('Phone OTP:', response.data.phone_otp_debug);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to send OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await authAPI.verifyAndUpdateRecoveryInfo({
        recovery_email: recoveryEmail || undefined,
        recovery_phone: recoveryPhone || undefined,
        email_otp: emailOtp || undefined,
        phone_otp: phoneOtp || undefined,
      });

      if (response.data.user) {
        updateUser(response.data.user);
      }

      setMessage({ type: 'success', text: 'Recovery details were verified and updated successfully.' });
      setOtpSent(false);
      setEmailOtp('');
      setPhoneOtp('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to verify OTP or update recovery information',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    try {
      setLoading(true);
      const res = await authAPI.updateProfile({ language: newLang });
      if (res.data.user) {
        updateUser(res.data.user);
        setLanguage(newLang);
      }
    } catch (e) {
      console.error("Failed to update language", e);
    } finally {
      setLoading(false);
    }
  };

  const languageChoices = [
    { key: 'en', label: t('language.english'), flag: '🇬🇧' },
    { key: 'hi', label: t('language.hindi'), flag: '🇮🇳' },
    { key: 'pa', label: t('language.punjabi'), flag: '🇮🇳' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t('profile.accountControls')}
        title={t('common.settings')}
        description={t('profile.personalize')}
        action={
          <button type="button" className="btn btn-secondary" onClick={resetPreferences}>
            <RotateCcw size={16} /> {t('profile.resetPrefs')}
          </button>
        }
      />

      <div className="settings-grid">
        <section className="settings-panel card">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">{t('common.profile')}</div>
              <h2>{t('profile.currentAccount')}</h2>
            </div>
          </div>

          <div className="profile-summary">
            <div className="profile-summary__avatar">
              {user?.full_name
                ?.split(' ')
                .map((part) => part[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <div className="profile-summary__name">{user?.full_name}</div>
              <div className="profile-summary__meta">{user?.email}</div>
              <div className="profile-summary__meta">{user?.phone}</div>
            </div>
          </div>

          <div className="mini-grid">
            <div className="mini-card">
              <Fingerprint size={16} />
              <div>
                <strong>{user?.kyc_status || 'pending'}</strong>
                <span>{t('profile.kycStatus')}</span>
              </div>
            </div>
            <div className="mini-card">
              <CheckCircle2 size={16} />
              <div>
                <strong>{user?.role || 'customer'}</strong>
                <span>{t('profile.accountRole')}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-panel card">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">{t('common.appearance')}</div>
              <h2>{t('appearance.themeTitle')}</h2>
            </div>
          </div>

          <div className="theme-grid">
            {themeChoices.map((themeChoice) => (
              <button
                key={themeChoice.key}
                type="button"
                className={`theme-card ${themeMode === themeChoice.key ? 'active' : ''}`}
                onClick={async () => {
                  setThemeMode(themeChoice.key);
                  try {
                    const res = await authAPI.updateProfile({ theme_mode: themeChoice.key });
                    if (res.data.user) updateUser(res.data.user);
                  } catch (e) {
                    console.error("Failed to save theme to DB", e);
                  }
                }}
              >
                <div className="theme-card__icon">{themeChoice.icon}</div>
                <div className="theme-card__title">{themeChoice.label}</div>
                <div className="theme-card__copy">{themeChoice.copy}</div>
              </button>
            ))}
          </div>

          <div className="theme-summary">
            <Zap size={16} />
            {t('appearance.instantly')}
          </div>
        </section>

        {/* Language Selection Section */}
        <section className="settings-panel card">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">{t('language.title')}</div>
              <h2>{t('language.select')}</h2>
            </div>
          </div>

          <div className="language-selector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {languageChoices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className={`theme-card ${lang === choice.key ? 'active' : ''}`}
                onClick={() => handleLanguageChange(choice.key)}
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                disabled={loading}
              >
                <div style={{ fontSize: '24px' }}>{choice.flag}</div>
                <div className="theme-card__title" style={{ margin: 0 }}>{choice.label}</div>
              </button>
            ))}
          </div>

          <div className="theme-summary" style={{ marginTop: '16px' }}>
            <Globe size={16} />
            {t('language.description')}
          </div>
        </section>
      </div>

      <section id="accessibility" className="settings-panel card">
        <div className="section-heading">
          <div>
            <div className="section-heading__eyebrow">{t('common.accessibility')}</div>
            <h2>{t('accessibility.title')}</h2>
          </div>
        </div>

        <div className="accessibility-grid">
          <SettingToggle
            title={t('accessibility.reduceMotion')}
            description="Tames transitions and animations across the app."
            checked={accessibility.reducedMotion}
            onChange={async (checked) => {
              const updates = { reducedMotion: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<SparkIcon />}
          />
          <SettingToggle
            title={t('accessibility.highContrast')}
            description="Sharpens borders, text, and key surfaces for visibility."
            checked={accessibility.highContrast}
            onChange={async (checked) => {
              const updates = { highContrast: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<Palette size={16} />}
          />
          <SettingToggle
            title={t('accessibility.largeText')}
            description="Increases the global text scale slightly for readability."
            checked={accessibility.largeText}
            onChange={async (checked) => {
              const updates = { largeText: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<Type size={16} />}
          />
          <SettingToggle
            title={t('accessibility.compactDensity')}
            description="Uses a tighter layout for power users."
            checked={accessibility.compactDensity}
            onChange={async (checked) => {
              const updates = { compactDensity: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<RotateCcw size={16} />}
          />
          <SettingToggle
            title={t('accessibility.voiceNavigation')}
            description="Allows hands-free navigation using voice commands."
            checked={accessibility.voiceNavigation}
            onChange={async (checked) => {
              const updates = { voiceNavigation: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<Mic size={16} />}
          />
          <SettingToggle
            title={t('accessibility.screenReader')}
            description="Optimizes content and aria tags for screen readers."
            checked={accessibility.screenReader}
            onChange={async (checked) => {
              const updates = { screenReader: checked };
              updateAccessibility(updates);
              try {
                const res = await authAPI.updateProfile({ accessibility: { ...accessibility, ...updates } });
                if (res.data.user) updateUser(res.data.user);
              } catch (e) {
                console.error("Failed to save accessibility to DB", e);
              }
            }}
            icon={<Volume2 size={16} />}
          />
        </div>
      </section>

      <section className="settings-panel card">
        <div className="section-heading">
          <div>
            <div className="section-heading__eyebrow">{t('common.security')}</div>
            <h2>Recovery email and phone</h2>
          </div>
        </div>

        <form className="settings-form" onSubmit={otpSent ? handleVerifyAndUpdate : handleSendOtp}>
          <div className="settings-form__grid">
            <div className="form-group">
              <label htmlFor="recovery-email">Recovery email</label>
              <input
                id="recovery-email"
                type="email"
                placeholder="backup@example.com"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                className="form-input"
                disabled={otpSent}
              />
            </div>

            <div className="form-group">
              <label htmlFor="recovery-phone">Recovery phone</label>
              <input
                id="recovery-phone"
                type="tel"
                placeholder="9876543210"
                value={recoveryPhone}
                onChange={(event) => setRecoveryPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                className="form-input"
                maxLength={10}
                disabled={otpSent}
              />
            </div>
          </div>

          {(user?.recovery_email || user?.recovery_phone) && (
            <div className="recovery-state">
              <div className="recovery-state__title">Current recovery details</div>
              {user?.recovery_email && <div><Mail size={14} /> {user.recovery_email}</div>}
              {user?.recovery_phone && <div><Phone size={14} /> {user.recovery_phone}</div>}
            </div>
          )}

          {otpSent && (
            <div className="settings-form__grid settings-form__grid--otp">
              {recoveryEmail && (
                <div className="form-group">
                  <label htmlFor="email-otp">Email OTP</label>
                  <input
                    id="email-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={emailOtp}
                    onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="form-input"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>
              )}

              {recoveryPhone && (
                <div className="form-group">
                  <label htmlFor="phone-otp">Phone OTP</label>
                  <input
                    id="phone-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={phoneOtp}
                    onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="form-input"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}

          {message && <div className={`settings-banner ${message.type}`}>{message.text}</div>}

          <div className="settings-actions">
            {otpSent && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setOtpSent(false);
                  setEmailOtp('');
                  setPhoneOtp('');
                  setMessage(null);
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!recoveryEmail && !recoveryPhone) || (otpSent && !emailOtp && !phoneOtp)}
            >
              {loading ? t('common.processing') : otpSent ? t('common.verifySave') : t('common.sendOtp')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

const SparkIcon = () => <SunMedium size={16} />;

export default Settings;
