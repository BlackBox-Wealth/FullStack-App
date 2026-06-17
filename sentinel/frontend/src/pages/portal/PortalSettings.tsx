import { Settings } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'

const THEMES = [
  { key: 'midnight', label: 'Midnight', desc: 'Dark navy, cyan accents' },
  { key: 'linen', label: 'Linen', desc: 'Light warm, teal accents' },
  { key: 'sepia', label: 'Sepia', desc: 'Warm parchment, amber' },
  { key: 'aurora', label: 'Aurora', desc: 'Sky blue, ocean navy' },
  { key: 'graphite', label: 'Graphite', desc: 'Charcoal, amber accents' },
] as const

export default function PortalSettings() {
  const { theme, setTheme, highContrast, setHighContrast, reducedMotion, setReducedMotion, largeText, setLargeText } = useUIStore()

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={18} className="text-accent-primary" />
        <h2 className="font-heading text-lg font-semibold text-text-primary">Settings</h2>
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Theme</h3>
          <div className="space-y-2">
            {THEMES.map(t => (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-sm border transition-fast ${theme === t.key ? 'border-accent-primary bg-accent-primary/5' : 'border-border hover:border-border-strong'}`}
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-text-primary">{t.label}</div>
                  <div className="text-xs text-text-muted">{t.desc}</div>
                </div>
                {theme === t.key && <div className="w-2 h-2 rounded-full bg-accent-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Accessibility</h3>
          <div className="space-y-3">
            {[
              { label: 'High Contrast', desc: 'Increase border and text contrast', val: highContrast, set: setHighContrast },
              { label: 'Reduced Motion', desc: 'Disable animations and transitions', val: reducedMotion, set: setReducedMotion },
              { label: 'Large Text', desc: 'Increase base font size by 15%', val: largeText, set: setLargeText },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text-primary">{item.label}</div>
                  <div className="text-xs text-text-muted">{item.desc}</div>
                </div>
                <button
                  onClick={() => item.set(!item.val)}
                  className={`relative w-10 h-5 rounded-full transition-fast ${item.val ? 'bg-accent-primary' : 'bg-bg-surface border border-border'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
