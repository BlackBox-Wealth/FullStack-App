import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface FormData {
  incident_type: string
  affected_system: string
  time_detected: string
  description: string
  immediate_action_taken: string
  escalation_path: string
}

export default function IncidentForm() {
  const { token } = useParams<{ token: string }>()
  const [formMeta, setFormMeta] = useState<{ trigger_scenario: string; time_limit_seconds: number } | null>(null)
  const [form, setForm] = useState<FormData>({ incident_type: '', affected_system: '', time_detected: '', description: '', immediate_action_taken: '', escalation_path: '' })
  const [timeLeft, setTimeLeft] = useState(300)
  const [submitted, setSubmitted] = useState<{ score: number; passed: boolean; ticket: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!token) return
    axios.get(`/api/sim/incident/form/${token}`)
      .then(r => {
        const data = r.data.data
        setFormMeta(data)
        setTimeLeft(data.time_limit_seconds ?? 300)
      })
      .catch(() => setFormMeta({ trigger_scenario: 'A security incident has been detected on your account. Please file an incident report immediately.', time_limit_seconds: 300 }))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!formMeta || submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [formMeta, submitted])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearInterval(timerRef.current!)
    try {
      const r = await axios.post(`/api/sim/incident/submit/${token}`, form)
      const data = r.data.data
      setSubmitted({ score: data.score, passed: data.passed, ticket: data.ticket_number ?? 'INC-XXXXXX' })
    } catch {
      setSubmitted({ score: 0, passed: false, ticket: `INC-${Date.now().toString(36).toUpperCase()}` })
    }
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const pct = formMeta ? (timeLeft / formMeta.time_limit_seconds) * 100 : 100
  const timerColor = pct > 50 ? '#0f9d58' : pct > 20 ? '#d97706' : '#dc2626'

  if (loading) return <div className="min-h-screen bg-bg-base flex items-center justify-center"><p className="text-text-muted text-sm">Loading…</p></div>

  if (submitted) return (
    <div className="min-h-screen bg-composite flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${submitted.passed ? 'bg-success/10' : 'bg-warning/10'}`}>
          <CheckCircle size={24} style={{ color: submitted.passed ? '#0f9d58' : '#d97706' }} />
        </div>
        <h2 className="font-heading text-lg font-bold text-text-primary mb-2">Report Submitted</h2>
        <p className="text-sm text-text-secondary mb-4">Your incident report has been filed and escalated to the IT Security team.</p>
        <div className="inline-block px-4 py-2 rounded-sm bg-bg-surface border border-border mb-4">
          <div className="text-xs text-text-muted">Ticket Number</div>
          <div className="font-mono font-bold text-text-primary">{submitted.ticket}</div>
        </div>
        <p className="text-xs text-text-muted">A detailed analysis will be sent to your Internal Mail inbox.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-composite p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header — looks like real incident system */}
        <div className="card mb-4 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-danger" />
                <span className="text-xs font-bold text-danger uppercase tracking-wider">URGENT — Security Incident</span>
              </div>
              <h1 className="font-heading text-base font-bold text-text-primary">PSB Incident Management System</h1>
            </div>
            <div className="text-right">
              <div className="text-xs text-text-muted mb-0.5">Response Required Within</div>
              <div className="font-mono font-bold text-lg" style={{ color: timerColor }}>{fmtTime(timeLeft)}</div>
              <div className="w-24 h-1 bg-bg-surface rounded-full mt-1 ml-auto">
                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: timerColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* Scenario */}
        <div className="px-4 py-3 rounded-sm bg-danger/10 border border-danger/20 mb-4 text-sm text-danger">
          <strong>Incident Alert:</strong> {formMeta?.trigger_scenario}
        </div>

        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold text-text-primary">Incident Report Form</h2>

          {[
            { key: 'incident_type', label: 'Incident Type', placeholder: 'e.g. Unauthorized Login Attempt, Data Breach, Malware...' },
            { key: 'affected_system', label: 'Affected System / Application', placeholder: 'e.g. Finacle CBS, Internal Portal, Email Client...' },
            { key: 'time_detected', label: 'Time Detected', placeholder: 'e.g. 26 May 2026, 03:42 AM' },
            { key: 'immediate_action_taken', label: 'Immediate Action Taken', placeholder: 'e.g. Locked account, disconnected workstation, notified supervisor...' },
            { key: 'escalation_path', label: 'Escalation Path', placeholder: 'e.g. IT Security Team → CISO → Branch Manager' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label} <span className="text-danger">*</span></label>
              <input
                required
                value={(form as any)[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Detailed Description <span className="text-danger">*</span></label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the incident in detail. Include what you observed, what systems are affected, potential impact, and any relevant context..."
              className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast resize-none"
            />
          </div>

          <button type="submit" className="w-full py-2.5 rounded-sm bg-danger text-white font-semibold text-sm hover:opacity-90 transition-fast">
            Submit Incident Report
          </button>
        </form>
      </div>
    </div>
  )
}
