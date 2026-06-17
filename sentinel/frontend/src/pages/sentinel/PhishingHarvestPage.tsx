import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function PhishingHarvestPage() {
  const { type } = useParams<{ type: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post(`/api/sim/phishing/credentials/${token}`, { submitted: true })
    } catch {}
    setTimeout(() => { setSubmitted(true); setLoading(false) }, 2000)
  }

  if (submitted) return <ErrorPage />

  const variant = type || 'rbi_portal'
  if (variant === 'internal_it') return <InternalITPage loading={loading} onSubmit={handleSubmit} />
  if (variant === 'upi_verification') return <UPIPage loading={loading} onSubmit={handleSubmit} />
  if (variant === 'hr_portal') return <HRPortalPage loading={loading} onSubmit={handleSubmit} />
  return <RBIPortalPage loading={loading} onSubmit={handleSubmit} />
}

// ─── Shared base styles ────────────────────────────────────────────────────────

const base: React.CSSProperties = {
  margin: 0, padding: 0, boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

function PageWrap({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div style={{ ...base, minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {children}
    </div>
  )
}

function Field({ label, type = 'text', name, placeholder, maxLength }: { label: string; type?: string; name: string; placeholder?: string; maxLength?: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        required
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}
        onFocus={e => (e.target.style.borderColor = '#2563eb')}
        onBlur={e => (e.target.style.borderColor = '#d1d5db')}
      />
    </div>
  )
}

// ─── RBI Portal ───────────────────────────────────────────────────────────────

function RBIPortalPage({ loading, onSubmit }: { loading: boolean; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <PageWrap bg="#eef1f6">
      <div style={{ background: '#fff', borderRadius: 8, padding: '40px 36px', width: '100%', maxWidth: 440, boxShadow: '0 2px 20px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#1a3558', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>RBI</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a3558', fontFamily: 'Georgia, serif' }}>Reserve Bank of India</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Regulated Entities Verification Portal</p>
        </div>

        {/* Alert */}
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '10px 14px', marginBottom: 22, fontSize: 13, color: '#92400e', textAlign: 'center' }}>
          ⚠️ <strong>Action Required:</strong> Your credentials require re-verification under RBI Circular RE-SEC/2025/47.
        </div>

        <form onSubmit={onSubmit}>
          <Field label="Employee ID / Username" name="username" placeholder="Enter your Employee ID" />
          <Field label="Password" type="password" name="password" placeholder="Enter your password" />
          <Field label="Verification Code" name="otp" placeholder="6-digit code" maxLength={6} />
          <div style={{ marginTop: -8, marginBottom: 18, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            This is a simulated phishing page. No OTP is actually sent in this flow.
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Arial, sans-serif' }}
          >
            {loading ? 'Verifying…' : 'Verify Identity'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
          Secured by RBI Verification Authority<br />
          <span style={{ color: '#4b5563' }}>rbi-verify.in</span> &nbsp;·&nbsp; © 2025 Reserve Bank of India
        </div>
      </div>
    </PageWrap>
  )
}

// ─── Internal IT Portal ───────────────────────────────────────────────────────

function InternalITPage({ loading, onSubmit }: { loading: boolean; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <PageWrap bg="#f3f4f6">
      {/* Top bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#003d7a', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#003d7a', fontWeight: 900, fontSize: 12 }}>PSB</span>
        </div>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Punjab &amp; Sind Bank — Internal IT Portal</span>
        <span style={{ marginLeft: 'auto', color: '#93c5fd', fontSize: 12 }}>Secure Connection</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 4, padding: '36px 32px', width: '100%', maxWidth: 420, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginTop: 52, border: '1px solid #e5e7eb' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>IT Systems Access</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Password reset required due to scheduled rotation. Sign in to proceed.</p>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '10px 14px', marginBottom: 22, fontSize: 13, color: '#1e40af' }}>
          🔒 IT Security Notice: Periodic credential verification is mandatory under IT Policy IT-SEC-2025-03.
        </div>

        <form onSubmit={onSubmit}>
          <Field label="Username (Employee ID)" name="username" placeholder="e.g. PSB\\arjun.mehta" />
          <Field label="Current Password" type="password" name="password" placeholder="Enter your current password" />
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 11, background: loading ? '#6b7280' : '#003d7a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Arial, sans-serif' }}
          >
            {loading ? 'Signing in…' : 'Sign In to IT Portal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#9ca3af' }}>
          IT Helpdesk — Ext. 4100 &nbsp;·&nbsp; psb-itsupport.in<br />
          © Punjab &amp; Sind Bank · Information Technology Division
        </div>
      </div>
    </PageWrap>
  )
}

// ─── UPI Verification Portal ──────────────────────────────────────────────────

function UPIPage({ loading, onSubmit }: { loading: boolean; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <PageWrap bg="#f0faf4">
      <div style={{ background: '#fff', borderRadius: 8, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 2px 16px rgba(0,166,81,0.12)', border: '1px solid #d1fae5' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, background: '#00a651', borderRadius: 12, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>NPCI</span>
            <span style={{ color: '#d1fae5', fontSize: 10 }}>UPI</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#064e3b' }}>NPCI UPI Verification</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>National Payments Corporation of India</p>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '10px 14px', marginBottom: 22, fontSize: 13, color: '#15803d' }}>
          Your UPI ID requires re-verification due to an update in RBI compliance guidelines (DPSS.CO.PD/2025/62). Complete verification to avoid service disruption.
        </div>

        <form onSubmit={onSubmit}>
          <Field label="UPI ID" name="upi_id" placeholder="yourname@bank" />
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>MPIN (6-digit)</label>
            <input
              type="password"
              name="mpin"
              placeholder="• • • • • •"
              maxLength={6}
              required
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 18, outline: 'none', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 8 }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 12, background: loading ? '#6b7280' : '#00a651', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Arial, sans-serif' }}
          >
            {loading ? 'Verifying…' : 'Verify UPI Credentials'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
          Secured by NPCI Fraud Prevention Systems<br />
          © 2025 National Payments Corporation of India · npci.org.in
        </div>
      </div>
    </PageWrap>
  )
}

// ─── HR Self-Service Portal ───────────────────────────────────────────────────

function HRPortalPage({ loading, onSubmit }: { loading: boolean; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <PageWrap bg="#f9fafb">
      {/* Header bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#4a5568', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>PSB HR Self-Service</span>
          <span style={{ color: '#e2e8f0', fontSize: 12, borderLeft: '1px solid #718096', paddingLeft: 12 }}>Employee Portal</span>
        </div>
        <span style={{ color: '#e2e8f0', fontSize: 12 }}>psb-hr.in</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 4, padding: '36px 32px', width: '100%', maxWidth: 440, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginTop: 64, border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a202c' }}>Employee Self-Service Login</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#718096' }}>Annual salary review documents are ready for your review. Sign in to access.</p>
        </div>

        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 4, padding: '10px 14px', marginBottom: 22, fontSize: 13, color: '#78350f' }}>
          📋 Action required: Acknowledge your updated salary structure before 31 May 2025 to confirm payroll processing.
        </div>

        <form onSubmit={onSubmit}>
          <Field label="Employee ID" name="employee_id" placeholder="e.g. PSB2024001" />
          <Field label="Date of Birth" type="date" name="dob" />
          <Field label="Portal Password" type="password" name="password" placeholder="Enter your HR portal password" />
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 11, background: loading ? '#a0aec0' : '#4a5568', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Arial, sans-serif' }}
          >
            {loading ? 'Signing in…' : 'Access HR Portal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
          HR Helpdesk: hr@psb-internal.in · Ext. 5200<br />
          © Punjab &amp; Sind Bank · Human Resources Division
        </div>
      </div>
    </PageWrap>
  )
}

// ─── Error Page (post-submit) ─────────────────────────────────────────────────

function ErrorPage() {
  return (
    <PageWrap bg="#f3f4f6">
      <div style={{ background: '#fff', borderRadius: 8, padding: '48px 36px', width: '100%', maxWidth: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>Service Temporarily Unavailable</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          We are unable to process your request at this time due to scheduled maintenance.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Please try again later or contact the IT Helpdesk.</p>
        <div style={{ marginTop: 24, padding: '10px 14px', background: '#f9fafb', borderRadius: 4, fontSize: 12, color: '#6b7280', border: '1px solid #e5e7eb' }}>
          Error Code: 503 — Gateway Timeout<br />
          Reference: GW-{Math.random().toString(36).slice(2, 10).toUpperCase()}
        </div>
      </div>
    </PageWrap>
  )
}
