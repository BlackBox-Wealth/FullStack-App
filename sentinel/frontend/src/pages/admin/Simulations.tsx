import { Fragment, useEffect, useRef, useState } from 'react'
import { Zap, ChevronDown, ChevronRight, Download, X, StopCircle, RefreshCw, Mail } from 'lucide-react'
import { adminApi } from '../../api/admin'

interface Campaign {
  campaign_id: string
  name: string
  trigger_type: string
  triggered_by?: string
  module: string
  target_count: number
  pass_rate: number
  status: string
  triggered_at: string
  completed_at?: string
  assignments?: Assignment[]
}

interface Assignment {
  assignment_id: string
  employee_id_hash: string
  module: string
  email_delivery_status: string
  status: string
  attempt?: { score: number; passed: boolean; completed_at?: string }
}

const MOCK_CAMPAIGNS: Campaign[] = [
  { campaign_id: 'c1', name: 'Auto Random Wave — phishing', trigger_type: 'automatic_random', triggered_by: 'admin001', module: 'phishing', status: 'completed', pass_rate: 72, target_count: 8, triggered_at: '2026-05-24T10:00:00' },
  { campaign_id: 'c2', name: 'Manual Single — social_eng', trigger_type: 'manual_single', triggered_by: 'admin001', module: 'social_eng', status: 'completed', pass_rate: 80, target_count: 1, triggered_at: '2026-05-23T14:00:00' },
  { campaign_id: 'c3', name: 'Bulk Dept — IT Admin', trigger_type: 'manual_bulk', triggered_by: 'admin001', module: 'incident_drill', status: 'active', pass_rate: 0, target_count: 5, triggered_at: '2026-05-25T09:00:00' },
  { campaign_id: 'c4', name: 'Auto Random Wave — incident_drill', trigger_type: 'automatic_random', triggered_by: 'admin001', module: 'incident_drill', status: 'completed', pass_rate: 60, target_count: 6, triggered_at: '2026-05-20T07:00:00' },
  { campaign_id: 'c5', name: 'Q1 Phishing Awareness', trigger_type: 'manual_bulk', triggered_by: 'admin001', module: 'phishing', status: 'completed', pass_rate: 55, target_count: 20, triggered_at: '2026-05-10T08:00:00' },
]

const MODULE_COLORS: Record<string, string> = { phishing: '#0ea5e9', social_eng: '#14b8a6', incident_drill: '#f59e0b' }
const TRIGGER_BADGE: Record<string, string> = { automatic_random: 'badge-info', manual_single: 'badge-neutral', manual_bulk: 'badge-warning' }
const STATUS_BADGE: Record<string, string> = { active: 'badge-warning', completed: 'badge-success', cancelled: 'badge-neutral' }
const DELIVERY_BADGE: Record<string, string> = { delivered: 'badge-success', pending: 'badge-warning', failed: 'badge-danger' }
const ASSIGN_STATUS_BADGE: Record<string, string> = { completed: 'badge-success', pending: 'badge-warning', in_progress: 'badge-info', expired: 'badge-neutral', cancelled: 'badge-neutral' }

function exportCSV(campaigns: Campaign[]) {
  const rows = [
    ['Campaign ID', 'Name', 'Type', 'Module', 'Targets', 'Pass Rate', 'Status', 'Triggered At'],
    ...campaigns.map(c => [c.campaign_id, c.name, c.trigger_type, c.module, c.target_count, c.status === 'active' ? '—' : `${c.pass_rate}%`, c.status, c.triggered_at]),
  ]
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'campaigns.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminSimulations() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({})
  const [loadingExpand, setLoadingExpand] = useState<string | null>(null)
  const [stopping, setStopping] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchCampaigns = (silent = false) => {
    if (!silent) setLoading(true)
    adminApi.getCampaigns({ status: filterStatus, module: filterModule })
      .then(r => {
        const data = r.data.data?.campaigns ?? MOCK_CAMPAIGNS
        setCampaigns(data)
        setLastRefresh(new Date())
        // Refresh expanded assignment list if open
        if (expandedId) {
          adminApi.getCampaign(expandedId)
            .then(r2 => setAssignments(prev => ({ ...prev, [expandedId]: r2.data.data?.assignments ?? [] })))
            .catch(() => {})
        }
      })
      .catch(() => setCampaigns(MOCK_CAMPAIGNS))
      .finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => {
    fetchCampaigns()
  }, [filterStatus, filterModule])

  // Poll every 15 s when any campaign is active
  useEffect(() => {
    const hasActive = campaigns.some(c => c.status === 'active')
    if (hasActive) {
      pollRef.current = setInterval(() => fetchCampaigns(true), 15_000)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [campaigns])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (assignments[id]) return
    setLoadingExpand(id)
    try {
      const r = await adminApi.getCampaign(id)
      setAssignments(prev => ({ ...prev, [id]: r.data.data?.assignments ?? [] }))
    } catch {
      setAssignments(prev => ({ ...prev, [id]: [] }))
    }
    setLoadingExpand(null)
  }

  const stopCampaign = async (id: string) => {
    setStopping(id)
    try {
      await adminApi.cancelCampaign(id)
      setCampaigns(prev => prev.map(c => c.campaign_id === id ? { ...c, status: 'cancelled' } : c))
    } catch {}
    setStopping(null)
    setConfirmStop(null)
  }

  const filtered = campaigns.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterModule !== 'all' && c.module !== filterModule) return false
    if (filterFrom && new Date(c.triggered_at) < new Date(filterFrom)) return false
    if (filterTo && new Date(c.triggered_at) > new Date(filterTo + 'T23:59:59')) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-accent-primary" />
          <h2 className="font-heading text-lg font-semibold text-text-primary">Campaigns</h2>
          <span className="badge-neutral px-2 py-0.5 rounded-full text-xs">{filtered.length} campaigns</span>
          {campaigns.some(c => c.status === 'active') && (
            <span className="flex items-center gap-1 text-xs text-warning px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse inline-block" />
              Live — auto-refreshing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={() => fetchCampaigns()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary transition-fast"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary transition-fast"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-text-muted mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Module</label>
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)}
            className="px-2 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none">
            <option value="all">All</option>
            <option value="phishing">Phishing</option>
            <option value="social_eng">Social Engineering</option>
            <option value="incident_drill">Incident Drill</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">From</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="px-2 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">To</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="px-2 py-1.5 rounded-sm bg-bg-surface border border-border text-text-primary text-xs focus:outline-none" />
        </div>
        {(filterStatus !== 'all' || filterModule !== 'all' || filterFrom || filterTo) && (
          <button onClick={() => { setFilterStatus('all'); setFilterModule('all'); setFilterFrom(''); setFilterTo('') }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-primary transition-fast">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Campaign table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              <th className="w-8 px-3 py-3" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Module</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Targets</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Pass Rate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Triggered</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => (
              <Fragment key={c.campaign_id}>
                <tr
                  onClick={() => toggleExpand(c.campaign_id)}
                  className="cursor-pointer hover:bg-bg-surface transition-fast"
                >
                  <td className="px-3 py-3 text-text-muted">
                    {expandedId === c.campaign_id
                      ? <ChevronDown size={14} />
                      : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-3 text-text-primary max-w-xs truncate font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`${TRIGGER_BADGE[c.trigger_type] ?? 'badge-neutral'} px-1.5 py-0.5 rounded text-xs`}>
                      {c.trigger_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: (MODULE_COLORS[c.module] || '#888') + '22', color: MODULE_COLORS[c.module] || '#888' }}>
                      {c.module.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.target_count}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.status === 'active' ? '—' : `${c.pass_rate}%`}</td>
                  <td className="px-4 py-3">
                    <span className={`${STATUS_BADGE[c.status] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs capitalize`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {c.status === 'completed' && c.completed_at
                      ? <span title={`Completed ${new Date(c.completed_at).toLocaleString('en-IN')}`} className="text-success">✓ {new Date(c.completed_at).toLocaleDateString('en-IN')}</span>
                      : new Date(c.triggered_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {c.status === 'active' && (
                      confirmStop === c.campaign_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-muted">Stop?</span>
                          <button
                            onClick={() => stopCampaign(c.campaign_id)}
                            disabled={stopping === c.campaign_id}
                            className="px-2 py-0.5 rounded text-xs bg-danger text-white hover:opacity-80 disabled:opacity-50 transition-fast"
                          >
                            {stopping === c.campaign_id ? '…' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmStop(null)}
                            className="px-2 py-0.5 rounded text-xs border border-border text-text-muted hover:text-text-primary transition-fast"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmStop(c.campaign_id)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-danger/40 text-danger hover:bg-danger/10 transition-fast"
                        >
                          <StopCircle size={11} /> Stop
                        </button>
                      )
                    )}
                  </td>
                </tr>

                {/* Inline expansion */}
                {expandedId === c.campaign_id && (
                  <tr>
                    <td colSpan={9} className="bg-bg-surface px-6 py-4">
                      {loadingExpand === c.campaign_id ? (
                        <p className="text-xs text-text-muted">Loading assignments…</p>
                      ) : assignments[c.campaign_id]?.length ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left pb-2 text-text-muted font-semibold">Employee</th>
                              <th className="text-left pb-2 text-text-muted font-semibold">Email Delivery</th>
                              <th className="text-left pb-2 text-text-muted font-semibold">Status</th>
                              <th className="text-left pb-2 text-text-muted font-semibold">Score</th>
                              <th className="text-left pb-2 text-text-muted font-semibold">Outcome</th>
                              <th className="text-left pb-2 text-text-muted font-semibold">Report</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {assignments[c.campaign_id].map(a => (
                              <tr key={a.assignment_id} className="py-1">
                                <td className="py-2 font-mono text-text-muted">{a.employee_id_hash.slice(0, 8)}…</td>
                                <td className="py-2">
                                  {a.module === 'phishing'
                                    ? <span className={`${DELIVERY_BADGE[a.email_delivery_status] ?? 'badge-neutral'} px-1.5 py-0.5 rounded`}>{a.email_delivery_status || 'pending'}</span>
                                    : <span className="text-text-muted text-xs italic">n/a</span>}
                                </td>
                                <td className="py-2">
                                  <span className={`${ASSIGN_STATUS_BADGE[a.status] ?? 'badge-neutral'} px-1.5 py-0.5 rounded capitalize`}>{a.status}</span>
                                </td>
                                <td className="py-2 font-semibold text-text-primary">
                                  {a.attempt?.score != null ? (
                                    <span style={{ color: (a.attempt.score ?? 0) >= 70 ? 'var(--color-success, #0f9d58)' : (a.attempt.score ?? 0) >= 40 ? 'var(--color-warning, #d97706)' : 'var(--color-danger, #dc2626)' }}>
                                      {a.attempt.score}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="py-2">
                                  {a.attempt
                                    ? <span className={a.attempt.passed ? 'text-success font-semibold' : 'text-danger font-semibold'}>{a.attempt.passed ? '✓ Passed' : '✗ Failed'}</span>
                                    : <span className="text-text-muted italic text-xs">Pending</span>}
                                </td>
                                <td className="py-2">
                                  {a.status === 'completed'
                                    ? (
                                      <span className="flex items-center gap-1 text-xs text-success">
                                        <Mail size={11} /> Sent
                                      </span>
                                    )
                                    : <span className="text-text-muted text-xs italic">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-text-muted">No assignment data available.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="py-12 text-center text-text-muted text-sm">Loading campaigns…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-text-muted text-sm">No campaigns match the current filters.</div>
        )}
      </div>
    </div>
  )
}
