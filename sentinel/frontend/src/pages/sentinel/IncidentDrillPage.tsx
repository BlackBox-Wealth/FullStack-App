import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

interface DrillForm {
  trigger_scenario: string
  time_limit_seconds: number
  required_fields: string[]
  started_at: string
}

const FIELD_LABELS: Record<string, string> = {
  incident_type: 'Incident Type',
  affected_system: 'Affected System / Application',
  time_detected: 'Time Detected',
  description: 'Incident Description',
  immediate_action_taken: 'Immediate Action Taken',
  escalation_path: 'Escalation Path',
}

const FIELD_HINTS: Record<string, string> = {
  incident_type: 'e.g. Unauthorised Access, Data Breach, Malware, Phishing Attempt',
  affected_system: 'e.g. Core Banking System, Email, VPN, Workstation ID',
  time_detected: 'e.g. 03:42 AM today, approx 15 minutes after receiving alert',
  description: 'Describe what happened in detail. Include any unusual behaviour, error messages, or suspicious activity observed.',
  immediate_action_taken: 'e.g. Locked workstation, changed password, disconnected from network, notified supervisor',
  escalation_path: 'e.g. IT Security Team → CISO → Branch Manager',
}

const s: Record<string, React.CSSProperties> = {
  root: {
    margin: 0, padding: 0, minHeight: '100vh',
    background: '#f8fafc', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1e293b',
  },
  header: {
    background: '#1e293b', padding: '0 24px', height: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  headerLogoBox: {
    background: '#e11d48', width: 34, height: 34, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: 0.5,
  },
  headerTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: 600 },
  headerSub: { color: '#94a3b8', fontSize: 12 },
  timerBadge: {
    padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 14,
    fontFamily: '"Courier New", monospace', letterSpacing: 1,
  },
  container: { maxWidth: 800, margin: '0 auto', padding: '24px 16px 48px' },
  alert: {
    background: '#fff1f2', border: '2px solid #fda4af', borderRadius: 6,
    padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start',
  },
  alertIcon: { fontSize: 22, marginTop: 2, flexShrink: 0 },
  alertTitle: { margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#be123c' },
  alertBody: { margin: 0, fontSize: 14, color: '#9f1239', lineHeight: 1.6 },
  formCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '28px 28px', marginBottom: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  formTitle: { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e293b' },
  formSub: { margin: '0 0 24px', fontSize: 13, color: '#64748b' },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 5 },
  fieldHint: { fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' },
  textarea: {
    width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 4,
    fontSize: 13, lineHeight: 1.5, resize: 'vertical' as const, minHeight: 72,
    boxSizing: 'border-box' as const, fontFamily: 'Arial, sans-serif',
    outline: 'none', color: '#1e293b',
  },
  submitBtn: {
    padding: '12px 28px', background: '#1e293b', color: '#fff', border: 'none',
    borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
  successCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '48px 32px',
    textAlign: 'center' as const, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  footer: {
    borderTop: '1px solid #e2e8f0', padding: '12px 24px',
    fontSize: 11, color: '#94a3b8', textAlign: 'center' as const, background: '#f8fafc',
  },
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function IncidentDrillPage() {
  const { token } = useParams<{ token: string }>()
  const [drill, setDrill] = useState<DrillForm | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(300)
  const [expired, setExpired] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refNumber, setRefNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const startedAt = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!token) { setLoadError(true); setLoading(false); return }
    axios.get(`/api/sim/incident/form/${token}`)
      .then(r => {
        const data: DrillForm = r.data.data
        setDrill(data)
        const initialFields: Record<string, string> = {}
        data.required_fields.forEach(f => { initialFields[f] = '' })
        setFields(initialFields)
        const limit = data.time_limit_seconds || 300
        const elapsed = data.started_at
          ? Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000)
          : 0
        const remaining = Math.max(0, limit - elapsed)
        setTimeLeft(remaining)
        setLoading(false)
      })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [token])

  const doSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting || submitted) return
    setSubmitting(true)
    const timeTaken = Date.now() - startedAt.current
    try {
      const r = await axios.post(`/api/sim/incident/submit/${token}`, {
        ...fields,
        time_taken_ms: timeTaken,
      })
      setRefNumber(r.data.data?.ticket_number || `INC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`)
    } catch {
      setRefNumber(`INC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`)
    }
    setSubmitted(true)
    setSubmitting(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [fields, submitting, submitted, token])

  useEffect(() => {
    if (!drill || expired || submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setExpired(true)
          clearInterval(timerRef.current!)
          doSubmit(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [drill, expired, submitted, doSubmit])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    let ok = true
    drill?.required_fields.forEach(f => {
      if ((fields[f] || '').trim().length < 10) {
        newErrors[f] = 'Please provide at least 10 characters'
        ok = false
      }
    })
    setErrors(newErrors)
    if (ok) doSubmit()
  }

  const timerColor = timeLeft <= 60 ? '#dc2626' : timeLeft <= 120 ? '#d97706' : '#1e293b'
  const timerBg = timeLeft <= 60 ? '#fee2e2' : timeLeft <= 120 ? '#fef3c7' : '#f1f5f9'

  if (loading) return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerLogo}><div style={s.headerLogoBox}>IMS</div><span style={s.headerTitle}>Incident Management System</span></div>
      </div>
      <div style={{ textAlign: 'center', padding: 80, color: '#64748b', fontSize: 14 }}>Loading incident form…</div>
    </div>
  )

  if (loadError) return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerLogo}><div style={s.headerLogoBox}>IMS</div><span style={s.headerTitle}>Incident Management System</span></div>
      </div>
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '32px 28px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>This link has expired</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>The incident drill session is no longer active. Contact IT Security if you believe this is an error.</p>
        </div>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerLogo}><div style={s.headerLogoBox}>IMS</div><span style={s.headerTitle}>PSB Incident Management System</span></div>
        <span style={s.headerSub}>Secure Portal</span>
      </div>
      <div style={s.container}>
        <div style={s.successCard}>
          <div style={{ width: 60, height: 60, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>✓</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Incident Report Submitted</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            Your incident report has been submitted successfully.<br />
            The PSB IT Security team will review your report and contact you shortly.
          </p>
          <div style={{ display: 'inline-block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '10px 20px', fontSize: 13, color: '#475569' }}>
            Reference Number: <strong style={{ color: '#1e293b', fontFamily: '"Courier New", monospace' }}>{refNumber}</strong>
          </div>
          <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
            {expired ? 'Response window closed — submitted automatically with available information.' : 'You may close this window.'}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLogo}>
          <div style={s.headerLogoBox}>IMS</div>
          <div>
            <div style={s.headerTitle}>PSB Incident Management System</div>
            <div style={s.headerSub}>IT Security Operations · Secure Portal</div>
          </div>
        </div>
        <div style={{ ...s.timerBadge, background: timerBg, color: timerColor, border: `1px solid ${timerColor}33` }}>
          Response window closes in {fmt(timeLeft)}
        </div>
      </div>

      <div style={s.container}>
        {/* Alert banner */}
        <div style={s.alert}>
          <span style={s.alertIcon}>🚨</span>
          <div>
            <p style={s.alertTitle}>Security Incident Detected — Immediate Response Required</p>
            <p style={s.alertBody}>{drill?.trigger_scenario || 'A security incident has been detected on your account. Complete the form below immediately.'}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={s.formCard}>
            <p style={s.formTitle}>Incident Response Report</p>
            <p style={s.formSub}>Complete all fields accurately. Incomplete or vague responses will affect your incident response score. Minimum 10 characters per field.</p>

            {drill?.required_fields.map(f => (
              <div key={f} style={s.fieldGroup}>
                <label style={s.fieldLabel}>
                  {FIELD_LABELS[f] || f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>
                </label>
                {FIELD_HINTS[f] && <span style={s.fieldHint}>{FIELD_HINTS[f]}</span>}
                <textarea
                  value={fields[f] || ''}
                  onChange={e => { setFields(prev => ({ ...prev, [f]: e.target.value })); setErrors(prev => ({ ...prev, [f]: '' })) }}
                  style={{ ...s.textarea, borderColor: errors[f] ? '#dc2626' : (fields[f]?.length >= 10 ? '#86efac' : '#cbd5e1') }}
                  rows={f === 'description' || f === 'immediate_action_taken' ? 4 : 2}
                  onFocus={e => { if (!errors[f]) e.target.style.borderColor = '#3b82f6' }}
                  onBlur={e => { e.target.style.borderColor = errors[f] ? '#dc2626' : (fields[f]?.length >= 10 ? '#86efac' : '#cbd5e1') }}
                />
                {errors[f] && <span style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>{errors[f]}</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              All fields are mandatory. Report will be reviewed by IT Security Operations.
            </p>
            <button type="submit" disabled={submitting} style={{ ...s.submitBtn, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit Incident Report →'}
            </button>
          </div>
        </form>
      </div>

      <div style={s.footer}>
        PSB Incident Management System · IT Security Operations · psb-ims.in · © Punjab &amp; Sind Bank
      </div>
    </div>
  )
}
