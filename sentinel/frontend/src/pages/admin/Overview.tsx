import { useCallback, useEffect, useState } from 'react'
import client from '../../api/client'
import { adminApi } from '../../api/admin'
import { Users, Zap, TrendingUp, AlertTriangle, X, Rocket, Settings2, UserCheck } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Profile {
  employee_id_hash: string
  name?: string
  email?: string
  department: string
  role: string
  average_score: number
  flagged: boolean
  pam_trust_score: number
}

const MOCK_STATS = {
  total_employees: 48,
  active_simulations_this_week: 12,
  overall_pass_rate: 67.4,
  flagged_employees: 3,
  recent_campaigns: [
    { campaign_id: 'c1', name: 'Auto Random Wave — phishing', trigger_type: 'automatic_random', module: 'phishing', status: 'completed', pass_rate: 72, target_count: 8, triggered_at: '2026-05-24T10:00:00' },
    { campaign_id: 'c2', name: 'Manual Single — social_eng', trigger_type: 'manual_single', module: 'social_eng', status: 'completed', pass_rate: 80, target_count: 1, triggered_at: '2026-05-23T14:00:00' },
    { campaign_id: 'c3', name: 'Bulk Dept — IT Admin', trigger_type: 'manual_bulk', module: 'incident_drill', status: 'active', pass_rate: 0, target_count: 5, triggered_at: '2026-05-25T09:00:00' },
  ],
}

const CHART_DATA = [
  { date: '15 May', phishing: 3, social_eng: 2, incident_drill: 1 },
  { date: '16 May', phishing: 4, social_eng: 1, incident_drill: 2 },
  { date: '17 May', phishing: 2, social_eng: 3, incident_drill: 1 },
  { date: '18 May', phishing: 5, social_eng: 2, incident_drill: 3 },
  { date: '19 May', phishing: 1, social_eng: 4, incident_drill: 2 },
  { date: '20 May', phishing: 3, social_eng: 1, incident_drill: 4 },
  { date: '21 May', phishing: 6, social_eng: 3, incident_drill: 1 },
  { date: '22 May', phishing: 4, social_eng: 2, incident_drill: 2 },
  { date: '23 May', phishing: 2, social_eng: 5, incident_drill: 3 },
  { date: '24 May', phishing: 7, social_eng: 3, incident_drill: 2 },
  { date: '25 May', phishing: 5, social_eng: 2, incident_drill: 4 },
  { date: '26 May', phishing: 3, social_eng: 4, incident_drill: 2 },
]

const MODULE_COLORS: Record<string, string> = { phishing: '#0ea5e9', social_eng: '#14b8a6', incident_drill: '#f59e0b' }
const TRIGGER_BADGE: Record<string, string> = {
  automatic_random: 'badge-info',
  manual_single: 'badge-neutral',
  manual_bulk: 'badge-warning',
}
const STATUS_BADGE: Record<string, string> = { active: 'badge-warning', completed: 'badge-success', cancelled: 'badge-neutral' }

// ─── Random Wave Confirmation Modal ──────────────────────────────────────────

function RandomWaveModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base font-semibold text-text-primary flex items-center gap-2">
            <Rocket size={16} className="text-accent-primary" /> Launch Random Wave
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>
        <div className="space-y-3 mb-5">
          <div className="px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Estimated targets</span><span className="text-text-primary font-semibold">10–20% of all active employees</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Module</span><span className="text-text-primary font-semibold">Random (weighted by weakest score)</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Template</span><span className="text-text-primary font-semibold">Auto-selected per role</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Due in</span><span className="text-text-primary font-semibold">168 hours</span></div>
          </div>
          <p className="text-xs text-text-muted">Simulation emails will be delivered immediately. Employees will not be notified in advance.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast">
            {loading ? 'Launching…' : 'Confirm Launch'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary transition-fast">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Builder Modal ───────────────────────────────────────────────────

interface BuilderForm {
  name: string
  target_type: 'all' | 'department' | 'specific_list'
  department: string
  module: 'phishing' | 'social_eng' | 'incident_drill' | 'random'
  template_id: string
  due_in_hours: number
}

const DEPARTMENTS = ['Retail Banking', 'IT', 'Loans', 'Operations', 'Compliance', 'HR', 'Risk']

function CampaignBuilderModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [form, setForm] = useState<BuilderForm>({ name: '', target_type: 'all', department: '', module: 'phishing', template_id: 'random', due_in_hours: 168 })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ campaign_id: string; assignments_created: number } | null>(null)
  const [error, setError] = useState('')

  const set = (k: keyof BuilderForm, v: any) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Campaign name is required'); return }
    setLoading(true)
    setError('')
    try {
      let target = form.target_type === 'all' ? 'all' : form.target_type === 'department' ? `department:${form.department}` : 'all'
      const r = await client.post('/admin/sim/campaigns/bulk', {
        name: form.name,
        target,
        module: form.module === 'random' ? ['phishing', 'social_eng', 'incident_drill'][Math.floor(Math.random() * 3)] : form.module,
        template_id: form.template_id === 'random' ? null : form.template_id,
        due_in_hours: form.due_in_hours,
      })
      setDone(r.data.data)
      onCreated?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create campaign')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-text-primary flex items-center gap-2">
            <Settings2 size={16} className="text-accent-primary" /> Configure Campaign
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Zap size={20} className="text-success" />
            </div>
            <p className="font-heading text-base font-semibold text-text-primary mb-1">Campaign Created</p>
            <p className="text-sm text-text-muted mb-4">
              {done.assignments_created} simulation emails are being delivered.
            </p>
            <div className="text-xs font-mono text-text-muted bg-bg-surface px-3 py-1.5 rounded-sm inline-block">
              ID: {done.campaign_id}
            </div>
            <button onClick={onClose} className="w-full mt-4 py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 transition-fast">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Campaign name */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Campaign Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Q2 Phishing Awareness Wave"
                className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent-primary" />
            </div>

            {/* Target type */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">Target</label>
              <div className="space-y-1.5">
                {([
                  { v: 'all', label: 'All employees' },
                  { v: 'department', label: 'By department' },
                ] as const).map(opt => (
                  <label key={opt.v} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="target_type" value={opt.v} checked={form.target_type === opt.v} onChange={() => set('target_type', opt.v)} className="accent-[color:var(--color-accent-primary)]" />
                    <span className="text-sm text-text-secondary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Department selector */}
            {form.target_type === 'department' && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Department</label>
                <select value={form.department} onChange={e => set('department', e.target.value)} required
                  className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none">
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Module */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">Module</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { v: 'phishing', label: 'Phishing', color: '#0ea5e9' },
                  { v: 'social_eng', label: 'Social Engineering', color: '#14b8a6' },
                  { v: 'incident_drill', label: 'Incident Drill', color: '#f59e0b' },
                  { v: 'random', label: 'Random', color: '#8b5cf6' },
                ] as const).map(opt => (
                  <label key={opt.v} className={`flex items-center gap-2 px-3 py-2 rounded-sm border cursor-pointer transition-fast ${form.module === opt.v ? 'border-accent-primary bg-accent-primary/5' : 'border-border hover:bg-bg-surface'}`}>
                    <input type="radio" name="module" value={opt.v} checked={form.module === opt.v} onChange={() => set('module', opt.v)} className="sr-only" />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                    <span className="text-xs text-text-secondary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Template */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Template</label>
              <select value={form.template_id} onChange={e => set('template_id', e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none">
                <option value="random">Auto-select (role-appropriate, random)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">Templates are filtered by module and matched to each employee's role.</p>
            </div>

            {/* Due in hours */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Due In (hours)</label>
              <input type="number" min={1} max={720} value={form.due_in_hours} onChange={e => set('due_in_hours', +e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none" />
              <p className="text-xs text-text-muted mt-1">Default 168h (7 days). After this window, incomplete assignments are marked expired.</p>
            </div>

            {error && <div className="px-3 py-2 rounded-sm bg-danger/10 text-danger text-xs">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast">
                {loading ? 'Creating…' : 'Launch Campaign'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary transition-fast">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Target User Modal ───────────────────────────────────────────────────────

function TargetUserModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [module, setModule] = useState<'phishing' | 'social_eng' | 'incident_drill'>('phishing')
  const [dueHours, setDueHours] = useState(168)
  const [launching, setLaunching] = useState(false)
  const [done, setDone] = useState<{ campaign_id: string } | null>(null)
  const [error, setError] = useState('')

  const searchEmployee = async () => {
    if (!email.trim()) return
    setSearching(true)
    setFound(null)
    setNotFound(false)
    setError('')
    try {
      const r = await adminApi.getEmployees({ limit: 100 })
      const profiles: Profile[] = r.data.data?.profiles ?? []
      const match = profiles.find(p => p.email?.toLowerCase() === email.trim().toLowerCase())
      if (match) {
        setFound(match)
      } else {
        setNotFound(true)
      }
    } catch {
      setError('Failed to search employees')
    }
    setSearching(false)
  }

  const launch = async () => {
    if (!found) return
    setLaunching(true)
    setError('')
    try {
      const r = await adminApi.triggerSingle({ employee_id_hash: found.employee_id_hash, module, due_in_hours: dueHours })
      setDone(r.data.data)
      onCreated?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to trigger simulation')
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-text-primary flex items-center gap-2">
            <UserCheck size={16} className="text-accent-primary" /> Target Specific User
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Zap size={20} className="text-success" />
            </div>
            <p className="font-heading text-base font-semibold text-text-primary mb-1">Simulation Assigned</p>
            <p className="text-sm text-text-muted mb-4">
              The {module.replace('_', ' ')} simulation has been delivered to {found?.name ?? email}.
            </p>
            <div className="text-xs font-mono text-text-muted bg-bg-surface px-3 py-1.5 rounded-sm inline-block mb-4">
              ID: {done.campaign_id}
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 transition-fast">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Email lookup */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Employee Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFound(null); setNotFound(false) }}
                  onKeyDown={e => e.key === 'Enter' && searchEmployee()}
                  placeholder="employee@psb.in"
                  className="flex-1 px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent-primary"
                />
                <button
                  onClick={searchEmployee}
                  disabled={searching || !email.trim()}
                  className="px-4 py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast"
                >
                  {searching ? '…' : 'Find'}
                </button>
              </div>
              {notFound && <p className="text-xs text-danger mt-1.5">No employee found with that email address.</p>}
              {error && !found && <p className="text-xs text-danger mt-1.5">{error}</p>}
            </div>

            {/* Found employee card */}
            {found && (
              <div className="px-4 py-3 rounded-sm bg-bg-surface border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">{found.name ?? found.email ?? 'Employee'}</span>
                  {found.flagged && <span className="text-xs badge-danger px-1.5 py-0.5 rounded">Flagged</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-text-muted">
                  <span>{found.department}</span>
                  <span className="capitalize">{found.role}</span>
                  <span>Avg score: <span className="text-text-primary font-medium">{found.average_score.toFixed(0)}</span></span>
                  <span>PAM: <span className={`font-medium ${found.pam_trust_score >= 0.75 ? 'text-success' : found.pam_trust_score >= 0.5 ? 'text-warning' : 'text-danger'}`}>{(found.pam_trust_score * 100).toFixed(0)}%</span></span>
                </div>
              </div>
            )}

            {/* Module + due hours (shown after employee found) */}
            {found && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">Module</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: 'phishing', label: 'Phishing', color: '#0ea5e9' },
                      { v: 'social_eng', label: 'Social Eng', color: '#14b8a6' },
                      { v: 'incident_drill', label: 'Incident Drill', color: '#f59e0b' },
                    ] as const).map(opt => (
                      <label key={opt.v} className={`flex items-center gap-2 px-2 py-2 rounded-sm border cursor-pointer transition-fast ${module === opt.v ? 'border-accent-primary bg-accent-primary/5' : 'border-border hover:bg-bg-surface'}`}>
                        <input type="radio" name="target_module" value={opt.v} checked={module === opt.v} onChange={() => setModule(opt.v)} className="sr-only" />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                        <span className="text-xs text-text-secondary">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Due In (hours)</label>
                  <input type="number" min={1} max={720} value={dueHours} onChange={e => setDueHours(+e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none" />
                </div>

                {error && <div className="px-3 py-2 rounded-sm bg-danger/10 text-danger text-xs">{error}</div>}

                <div className="flex gap-2 pt-1">
                  <button onClick={launch} disabled={launching}
                    className="flex-1 py-2.5 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast">
                    {launching ? 'Launching…' : 'Launch Simulation'}
                  </button>
                  <button onClick={onClose}
                    className="px-4 py-2.5 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary transition-fast">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {!found && (
              <div className="flex justify-end">
                <button onClick={onClose} className="px-4 py-2 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary transition-fast">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Overview Component ──────────────────────────────────────────────────

export default function AdminOverview() {
  const [stats, setStats] = useState(MOCK_STATS)
  const [showRandom, setShowRandom] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showTargetUser, setShowTargetUser] = useState(false)
  const [randomLoading, setRandomLoading] = useState(false)
  const [randomResult, setRandomResult] = useState<{ targets: number; module: string } | null>(null)

  const fetchStats = useCallback(() => {
    client.get('/admin/sim/stats/overview')
      .then(r => setStats(s => ({ ...s, ...r.data.data })))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const launchRandom = async () => {
    setRandomLoading(true)
    try {
      const r = await client.post('/admin/sim/campaigns/random')
      setRandomResult(r.data.data)
      setShowRandom(false)
      setStats(s => ({
        ...s,
        active_simulations_this_week: s.active_simulations_this_week + 1,
        recent_campaigns: [
          {
            campaign_id: r.data.data.campaign_id,
            name: `Auto Random Wave — ${r.data.data.module ?? 'mixed'}`,
            trigger_type: 'automatic_random',
            module: r.data.data.module ?? 'phishing',
            status: 'active',
            pass_rate: 0,
            target_count: r.data.data.targets ?? 0,
            triggered_at: new Date().toISOString(),
          },
          ...s.recent_campaigns,
        ],
      }))
    } catch {}
    setRandomLoading(false)
  }

  const STAT_CARDS = [
    { label: 'Total Employees', value: stats.total_employees, icon: Users, color: 'text-accent-primary' },
    { label: 'Active This Week', value: stats.active_simulations_this_week, icon: Zap, color: 'text-warning' },
    { label: 'Pass Rate', value: `${stats.overall_pass_rate}%`, icon: TrendingUp, color: 'text-success' },
    { label: 'Flagged', value: stats.flagged_employees, icon: AlertTriangle, color: 'text-danger' },
  ]

  return (
    <div className="space-y-6">
      {showRandom && (
        <RandomWaveModal
          onClose={() => setShowRandom(false)}
          onConfirm={launchRandom}
          loading={randomLoading}
        />
      )}
      {showBuilder && <CampaignBuilderModal onClose={() => setShowBuilder(false)} onCreated={fetchStats} />}
      {showTargetUser && <TargetUserModal onClose={() => setShowTargetUser(false)} onCreated={fetchStats} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-bold text-text-primary">Overview</h2>
          <p className="text-sm text-text-muted mt-0.5">Simulation lab health &amp; activity summary</p>
        </div>

        {/* Action buttons */}
        <div className="card p-4 flex flex-col sm:flex-row gap-2 shrink-0">
          {randomResult ? (
            <div className="text-xs text-success px-2 py-1">
              ✓ Wave launched — {randomResult.targets} targets, module: {randomResult.module}
            </div>
          ) : (
            <button
              onClick={() => setShowRandom(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 transition-fast"
            >
              <Rocket size={14} /> Launch Random Wave
            </button>
          )}
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-fast"
          >
            <Settings2 size={14} /> Configure Campaign
          </button>
          <button
            onClick={() => setShowTargetUser(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-sm border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-fast"
          >
            <UserCheck size={14} /> Target User
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="card p-4">
              <Icon size={18} className={`${c.color} mb-2`} />
              <div className="font-heading text-2xl font-bold text-text-primary">{c.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{c.label}</div>
            </div>
          )
        })}
      </div>

      {/* Activity chart */}
      <div className="card p-5">
        <h3 className="font-heading text-base font-semibold text-text-primary mb-4">30-Day Simulation Activity</h3>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {Object.entries(MODULE_COLORS).map(([m, c]) => (
            <div key={m} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: c }} />
              <span className="text-xs text-text-muted capitalize">{m.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="phishing" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="social_eng" stroke="#14b8a6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="incident_drill" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent campaigns */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-heading text-base font-semibold text-text-primary">Recent Campaigns</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Campaign</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Module</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Targets</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Pass Rate</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.recent_campaigns.slice(0, 8).map(c => (
              <tr key={c.campaign_id} className="hover:bg-bg-surface transition-fast">
                <td className="px-5 py-3 text-text-primary text-sm max-w-xs truncate">{c.name}</td>
                <td className="px-5 py-3">
                  <span className={`${TRIGGER_BADGE[c.trigger_type] ?? 'badge-neutral'} px-1.5 py-0.5 rounded text-xs capitalize`}>
                    {c.trigger_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: (MODULE_COLORS[c.module] || '#888') + '22', color: MODULE_COLORS[c.module] || '#888' }}>
                    {c.module.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-text-secondary">{c.target_count}</td>
                <td className="px-5 py-3 text-text-secondary">{c.status === 'active' ? '—' : `${c.pass_rate}%`}</td>
                <td className="px-5 py-3">
                  <span className={`${STATUS_BADGE[c.status] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs font-medium capitalize`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
