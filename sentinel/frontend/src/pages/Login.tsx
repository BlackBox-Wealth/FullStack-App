import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Eye, EyeOff } from 'lucide-react'
import client from '../api/client'
import { useAuthStore } from '../store/useAuthStore'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await client.post('/auth/login', { email, password })
      const user = res.data.user
      const role: string = user?.role ?? ''
      if (role !== 'super_admin' && role !== 'superadmin') {
        setError('Access denied. This panel requires administrator privileges.')
        setLoading(false)
        return
      }
      setUser({
        id: user.id,
        name: user.full_name ?? user.name ?? user.email,
        email: user.email,
        role,
      })
      navigate('/admin/overview', { replace: true })
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(detail ?? 'Login failed. Check your credentials and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-composite flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-danger/15 flex items-center justify-center mb-4 ring-1 ring-danger/20">
            <Shield size={26} className="text-danger" />
          </div>
          <h1 className="font-heading text-xl font-bold text-text-primary">Sentinel Admin</h1>
          <p className="text-xs text-text-muted mt-1">WealthVault Security Operations</p>
        </div>

        <div className="card p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="admin@wealthvault.com"
                className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-fast"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-sm bg-danger/10 border border-danger/20">
                <Lock size={13} className="text-danger mt-0.5 shrink-0" />
                <p className="text-xs text-danger leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-sm bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <Shield size={11} />
            <span>PSB Sentinel · Restricted Access</span>
          </div>
        </div>
      </div>
    </div>
  )
}