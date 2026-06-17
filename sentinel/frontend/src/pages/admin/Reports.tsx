import { useEffect, useState } from 'react'
import client from '../../api/client'
import { FileBarChart, Zap, Download } from 'lucide-react'

const MOCK_LEADERBOARD = [
  { _id: 'Retail Banking', avg_score: 74.2, total: 12, pass_rate: 66.7, flagged_count: 1, certified: 2, trained: 5, aware: 4, needs_training: 1 },
  { _id: 'IT', avg_score: 55.3, total: 8, pass_rate: 50.0, flagged_count: 2, certified: 1, trained: 2, aware: 3, needs_training: 2 },
  { _id: 'Loans', avg_score: 82.1, total: 10, pass_rate: 80.0, flagged_count: 0, certified: 4, trained: 4, aware: 2, needs_training: 0 },
  { _id: 'Operations', avg_score: 68.9, total: 9, pass_rate: 62.5, flagged_count: 1, certified: 1, trained: 4, aware: 3, needs_training: 1 },
  { _id: 'Compliance', avg_score: 88.4, total: 6, pass_rate: 83.3, flagged_count: 0, certified: 3, trained: 2, aware: 1, needs_training: 0 },
]

const MOCK_FLAGGED = [
  { employee_id_hash: 'c3d4e5f6a1b2abcdef', name: 'Vikram Nair', department: 'IT', role: 'IT_admin', flag_reason: 'Submitted credentials in phishing simulation', last_simulation: '2026-05-18', average_score: 38.0 },
  { employee_id_hash: 'f7g8h9i0j1k2lmnopq', name: 'Sunita Rao', department: 'Operations', role: 'teller', flag_reason: 'Two fails in 7 days', last_simulation: '2026-05-20', average_score: 42.5 },
  { employee_id_hash: 'r3s4t5u6v7w8xyzabc', name: 'Rahul Singh', department: 'IT', role: 'teller', flag_reason: 'Average score below 40', last_simulation: '2026-05-19', average_score: 35.0 },
]

function csvRow(cells: (string | number)[]) {
  return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminReports() {
  const [leaderboard, setLeaderboard] = useState(MOCK_LEADERBOARD)
  const [flagged, setFlagged] = useState(MOCK_FLAGGED)
  const [posture, setPosture] = useState({ pam_trust_score: 0.71, status: 'warning' })
  const [sortKey, setSortKey] = useState<keyof typeof MOCK_LEADERBOARD[0]>('avg_score')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    Promise.all([
      client.get('/admin/sim/reports/leaderboard').then(r => setLeaderboard(r.data.data?.departments ?? MOCK_LEADERBOARD)).catch(() => {}),
      client.get('/admin/sim/reports/flagged').then(r => setFlagged(r.data.data?.flagged ?? MOCK_FLAGGED)).catch(() => {}),
      client.get('/admin/sim/reports/posture').then(r => setPosture(r.data.data ?? posture)).catch(() => {}),
    ])
  }, [])

  const sorted = [...leaderboard].sort((a, b) => {
    const va = a[sortKey] as number, vb = b[sortKey] as number
    return sortAsc ? va - vb : vb - va
  })

  const sort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10)
    const lines: string[] = []

    lines.push('PSB Sentinel — Security Simulation Report')
    lines.push(`Generated: ${new Date().toLocaleString('en-IN')}`)
    lines.push('')

    lines.push('PLATFORM SECURITY POSTURE')
    lines.push(csvRow(['PAM Trust Score', 'Status']))
    lines.push(csvRow([`${Math.round(posture.pam_trust_score * 100)}%`, posture.status]))
    lines.push('')

    lines.push('DEPARTMENT LEADERBOARD')
    lines.push(csvRow(['Department', 'Avg Score', 'Pass Rate (%)', 'Total Employees', 'Flagged', 'Certified', 'Trained', 'Aware', 'Needs Training']))
    for (const d of sorted) {
      lines.push(csvRow([d._id, d.avg_score.toFixed(1), d.pass_rate.toFixed(1), d.total, d.flagged_count, d.certified, d.trained, d.aware, d.needs_training]))
    }
    lines.push('')

    lines.push('FLAGGED EMPLOYEES')
    lines.push(csvRow(['Name', 'Employee Hash', 'Department', 'Role', 'Flag Reason', 'Avg Score', 'Last Simulation']))
    for (const e of flagged) {
      lines.push(csvRow([(e as any).name || '', e.employee_id_hash, e.department, e.role, e.flag_reason, e.average_score.toFixed(1), e.last_simulation ?? '']))
    }

    downloadCSV(lines.join('\n'), `sentinel-report-${date}.csv`)
  }

  const postureColor = posture.status === 'success' ? '#0f9d58' : posture.status === 'warning' ? '#d97706' : '#dc2626'
  const posturePct = Math.round(posture.pam_trust_score * 100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileBarChart size={18} className="text-accent-primary" />
          <h2 className="font-heading text-lg font-semibold text-text-primary">Reports</h2>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-accent-primary text-text-inverse text-sm font-semibold hover:opacity-90 transition-fast"
        >
          <Download size={14} /> Download Report
        </button>
      </div>

      {/* Top section: Leaderboard + Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Leaderboard */}
        <div className="lg:col-span-3 card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-heading text-base font-semibold text-text-primary">Department Leaderboard</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface">
                {[
                  { key: '_id', label: 'Department' },
                  { key: 'avg_score', label: 'Avg Score' },
                  { key: 'pass_rate', label: 'Pass Rate' },
                  { key: 'total', label: 'Employees' },
                  { key: 'flagged_count', label: 'Flagged' },
                  { key: null, label: 'Certifications' },
                ].map(({ key, label }) => (
                  <th key={label}
                    onClick={() => key && sort(key as any)}
                    className={`text-left px-4 py-3 text-xs font-semibold text-text-muted ${key ? 'cursor-pointer hover:text-text-secondary' : ''}`}>
                    {label} {key && sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map(dept => (
                <tr key={dept._id} className="hover:bg-bg-surface transition-fast">
                  <td className="px-4 py-3 font-medium text-text-primary">{dept._id}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${dept.avg_score >= 75 ? 'text-success' : dept.avg_score >= 50 ? 'text-warning' : 'text-danger'}`}>
                      {dept.avg_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{dept.pass_rate.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-text-secondary">{dept.total}</td>
                  <td className="px-4 py-3">
                    {dept.flagged_count > 0
                      ? <span className="badge-danger px-2 py-0.5 rounded text-xs">{dept.flagged_count}</span>
                      : <span className="text-text-muted text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {dept.certified > 0 && <span className="badge-success px-1.5 py-0.5 rounded text-xs">{dept.certified}C</span>}
                      {dept.trained > 0 && <span className="badge-info px-1.5 py-0.5 rounded text-xs">{dept.trained}T</span>}
                      {dept.aware > 0 && <span className="badge-warning px-1.5 py-0.5 rounded text-xs">{dept.aware}A</span>}
                      {dept.needs_training > 0 && <span className="badge-danger px-1.5 py-0.5 rounded text-xs">{dept.needs_training}N</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Security posture gauge */}
        <div className="card p-5 flex flex-col items-center justify-center text-center">
          <h3 className="font-heading text-sm font-semibold text-text-primary mb-4">Platform Security Posture</h3>
          <svg viewBox="0 0 100 60" className="w-32">
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="var(--color-border)" strokeWidth="10" strokeLinecap="round" />
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke={postureColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${posturePct * 1.257} 125.7`} />
          </svg>
          <div className="font-heading text-3xl font-bold mt-2" style={{ color: postureColor }}>{posturePct}</div>
          <div className="text-xs text-text-muted mt-0.5">PAM Trust Score</div>
          <div className={`mt-2 px-2 py-0.5 rounded text-xs font-medium capitalize ${posture.status === 'success' ? 'badge-success' : posture.status === 'warning' ? 'badge-warning' : 'badge-danger'}`}>
            {posture.status}
          </div>
          <p className="text-xs text-text-muted mt-3 leading-relaxed">
            {posture.status === 'danger' && 'High risk. Immediate retraining required.'}
            {posture.status === 'warning' && 'Moderate risk. Review flagged employees.'}
            {posture.status === 'success' && 'Good posture. Continue regular testing.'}
          </p>
        </div>
      </div>

      {/* Flagged employees */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-text-primary">Flagged Employees</h3>
          <span className="badge-danger px-2 py-0.5 rounded-full text-xs">{flagged.length} flagged</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              {['Employee', 'Dept.', 'Role', 'Flag Reason', 'Avg Score', 'Last Sim', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {flagged.map(emp => (
              <tr key={emp.employee_id_hash} className="hover:bg-bg-surface transition-fast">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-text-primary">{(emp as any).name || emp.employee_id_hash.slice(0, 12) + '…'}</div>
                  {(emp as any).name && <div className="font-mono text-xs text-text-muted">{emp.employee_id_hash.slice(0, 8)}…</div>}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">{emp.department}</td>
                <td className="px-4 py-3 text-xs text-text-muted">{emp.role}</td>
                <td className="px-4 py-3 text-xs text-danger max-w-xs">{emp.flag_reason}</td>
                <td className="px-4 py-3 font-bold text-danger">{emp.average_score.toFixed(1)}</td>
                <td className="px-4 py-3 text-xs text-text-muted">{emp.last_simulation}</td>
                <td className="px-4 py-3">
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-fast">
                    <Zap size={11} /> Retrain
                  </button>
                </td>
              </tr>
            ))}
            {flagged.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">No flagged employees.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
