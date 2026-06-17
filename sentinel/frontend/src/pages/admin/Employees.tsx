import { useEffect, useState } from 'react'
import client from '../../api/client'
import { Users, ChevronRight, X, Zap } from 'lucide-react'

interface Profile {
  employee_id_hash: string
  name?: string
  email?: string
  department: string
  role: string
  certification_status: string
  average_score: number
  total_attempts: number
  last_simulation: string
  flagged: boolean
  pam_trust_score: number
  history?: any[]
}

const MOCK_PROFILES: Profile[] = [
  { employee_id_hash: 'a1b2c3d4e5f6...', name: 'Arjun Mehta', department: 'Retail Banking', role: 'teller', certification_status: 'trained', average_score: 78.5, total_attempts: 6, last_simulation: '2026-05-22', flagged: false, pam_trust_score: 0.78 },
  { employee_id_hash: 'b2c3d4e5f6a1...', name: 'Priya Sharma', department: 'Loans', role: 'loan_officer', certification_status: 'certified', average_score: 91.2, total_attempts: 8, last_simulation: '2026-05-20', flagged: false, pam_trust_score: 0.91 },
  { employee_id_hash: 'c3d4e5f6a1b2...', name: 'Vikram Nair', department: 'IT', role: 'IT_admin', certification_status: 'needs_training', average_score: 38.0, total_attempts: 4, last_simulation: '2026-05-18', flagged: true, pam_trust_score: 0.3 },
  { employee_id_hash: 'd4e5f6a1b2c3...', name: 'Sunita Rao', department: 'Operations', role: 'teller', certification_status: 'aware', average_score: 58.3, total_attempts: 5, last_simulation: '2026-05-24', flagged: false, pam_trust_score: 0.58 },
  { employee_id_hash: 'e5f6a1b2c3d4...', name: 'Ananya Patel', department: 'Compliance', role: 'loan_officer', certification_status: 'trained', average_score: 82.1, total_attempts: 7, last_simulation: '2026-05-21', flagged: false, pam_trust_score: 0.82 },
]

const CERT_BADGE: Record<string, string> = { certified: 'badge-success', trained: 'badge-info', aware: 'badge-warning', needs_training: 'badge-danger' }

function TriggerModal({ hash, onClose }: { hash: string; onClose: () => void }) {
  const [module, setModule] = useState('phishing')
  const [dueHours, setDueHours] = useState(168)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await client.post('/admin/sim/campaigns/single', { employee_id_hash: hash, module, due_in_hours: dueHours })
      setDone(true)
    } catch { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base font-semibold text-text-primary">Trigger Simulation</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>
        {done ? (
          <p className="text-sm text-success">Simulation assigned successfully.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">Module</label>
              <select value={module} onChange={e => setModule(e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none">
                <option value="phishing">Phishing</option>
                <option value="social_eng">Social Engineering</option>
                <option value="incident_drill">Incident Drill</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">Due In (hours)</label>
              <input type="number" value={dueHours} onChange={e => setDueHours(+e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none" />
            </div>
            <button onClick={submit} disabled={loading}
              className="w-full py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-fast">
              {loading ? 'Assigning…' : 'Assign Simulation'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminEmployees() {
  const [profiles, setProfiles] = useState<Profile[]>(MOCK_PROFILES)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [triggerHash, setTriggerHash] = useState<string | null>(null)
  const [dept, setDept] = useState('')
  const [flagged, setFlagged] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (dept) params.set('department', dept)
    if (flagged) params.set('flagged', flagged)
    client.get(`/admin/sim/employees?${params}`)
      .then(r => setProfiles(r.data.data?.profiles ?? MOCK_PROFILES))
      .catch(() => {})
  }, [dept, flagged])

  const filtered = profiles.filter(p =>
    (!dept || p.department.toLowerCase().includes(dept.toLowerCase())) &&
    (!flagged || (flagged === 'true') === p.flagged)
  )

  return (
    <div className="space-y-4">
      {triggerHash && <TriggerModal hash={triggerHash} onClose={() => setTriggerHash(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-accent-primary" />
          <h2 className="font-heading text-lg font-semibold text-text-primary">Employees</h2>
          <span className="badge-neutral px-2 py-0.5 rounded-full text-xs">{filtered.length} profiles</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input placeholder="Filter department…" value={dept} onChange={e => setDept(e.target.value)}
            className="px-3 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-accent-primary" />
          <select value={flagged} onChange={e => setFlagged(e.target.value)}
            className="px-3 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none">
            <option value="">All employees</option>
            <option value="true">Flagged only</option>
            <option value="false">Not flagged</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className="lg:col-span-2 card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface">
                {['Employee', 'Dept.', 'Role', 'Certification', 'Avg Score', 'PAM', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => (
                <tr key={p.employee_id_hash}
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer hover:bg-bg-surface transition-fast ${selected?.employee_id_hash === p.employee_id_hash ? 'bg-accent-primary/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-text-primary">
                        {p.name || p.employee_id_hash.slice(0, 8) + '…'}
                      </span>
                      {p.flagged && <span className="text-danger text-xs">⚑</span>}
                    </div>
                    {p.name && <div className="font-mono text-xs text-text-muted">{p.employee_id_hash.slice(0, 8)}…</div>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{p.department}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{p.role}</td>
                  <td className="px-4 py-3">
                    <span className={`${CERT_BADGE[p.certification_status] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs capitalize`}>
                      {p.certification_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary font-semibold">{p.average_score.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${p.pam_trust_score >= 0.75 ? 'text-success' : p.pam_trust_score >= 0.5 ? 'text-warning' : 'text-danger'}`}>
                      {p.pam_trust_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-text-muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div className="card p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-text-primary">Employee Profile</h3>
                <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
              </div>
              {selected.name
                ? <div className="text-base font-semibold text-text-primary">{selected.name}</div>
                : null}
              <div className="font-mono text-xs text-text-muted break-all">{selected.employee_id_hash}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Department', selected.department],
                  ['Role', selected.role],
                  ['Attempts', selected.total_attempts],
                  ['Last Sim', selected.last_simulation ?? '—'],
                ].map(([k, v]) => (
                  <div key={k as string} className="card-surface px-3 py-2">
                    <div className="text-text-muted">{k}</div>
                    <div className="font-medium text-text-primary capitalize">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">PAM Trust Score</div>
                <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${selected.pam_trust_score * 100}%`, background: selected.pam_trust_score >= 0.75 ? '#0f9d58' : selected.pam_trust_score >= 0.5 ? '#d97706' : '#dc2626' }} />
                </div>
                <div className="text-xs font-semibold text-text-primary mt-1">{(selected.pam_trust_score * 100).toFixed(0)}%</div>
              </div>
              {selected.flagged && (
                <div className="px-3 py-2 rounded-sm bg-danger/10 text-danger text-xs">⚑ Employee is flagged for retraining</div>
              )}
              <button
                onClick={() => setTriggerHash(selected.employee_id_hash)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-sm bg-accent-primary/10 text-accent-primary text-sm font-medium hover:bg-accent-primary/20 transition-fast"
              >
                <Zap size={14} /> Trigger Simulation
              </button>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">
              Select an employee to view profile
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
