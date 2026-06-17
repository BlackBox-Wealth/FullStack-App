import { useNavigate } from 'react-router-dom'
import { Shield, Users, Zap, BarChart3, ArrowRight, Lock } from 'lucide-react'

const FEATURES = [
  { icon: Zap,       label: 'Phishing Simulations',   desc: 'Realistic email phishing campaigns targeting employee behaviour' },
  { icon: Users,     label: 'Social Engineering',      desc: 'Vishing and pretexting drills to test identity-verification habits' },
  { icon: BarChart3, label: 'Incident Drill',          desc: 'Timed incident response exercises with full scoring and feedback' },
  { icon: Shield,    label: 'PAM Trust Scoring',       desc: 'Continuous privileged-access trust metrics per employee profile' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-composite flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
            <span className="font-heading font-bold text-accent-primary text-xs">PSB</span>
          </div>
          <span className="font-heading font-semibold text-text-primary text-sm">Punjab &amp; Sind Bank</span>
          <span className="text-text-muted text-xs hidden sm:block">· Sentinel Security Platform</span>
        </div>
        <button
          onClick={() => navigate('/admin/login')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-danger/30 text-danger text-xs font-medium hover:bg-danger/10 transition-fast"
        >
          <Lock size={12} /> Admin
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/15 flex items-center justify-center mb-6 ring-1 ring-danger/20">
          <Shield size={28} className="text-danger" />
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-3 max-w-xl leading-tight">
          WealthVault<br />
          <span className="text-danger">Sentinel</span>
        </h1>
        <p className="text-text-muted text-base max-w-md mb-10">
          Automated employee security-awareness training through
          real-world phishing, social engineering, and incident-response simulations.
        </p>

        {/* Entry cards */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <button
            onClick={() => navigate('/login')}
            className="group flex items-center gap-3 px-6 py-4 rounded-sm bg-accent-primary text-text-inverse font-semibold text-sm hover:opacity-90 transition-fast shadow-lg"
          >
            <Users size={18} />
            Employee Portal
            <ArrowRight size={16} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/admin/login')}
            className="group flex items-center gap-3 px-6 py-4 rounded-sm bg-bg-card border border-danger/30 text-danger font-semibold text-sm hover:bg-danger/8 transition-fast"
          >
            <Shield size={18} />
            Admin Control Panel
            <ArrowRight size={16} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="card p-5 text-left">
              <div className="w-8 h-8 rounded-md bg-accent-primary/10 flex items-center justify-center mb-3">
                <Icon size={16} className="text-accent-primary" />
              </div>
              <div className="font-semibold text-text-primary text-sm mb-1">{label}</div>
              <div className="text-text-muted text-xs leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-text-muted border-t border-border">
        © {new Date().getFullYear()} Punjab &amp; Sind Bank · Internal Use Only
      </footer>
    </div>
  )
}
