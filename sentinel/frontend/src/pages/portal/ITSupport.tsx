import { useState } from 'react'
import { Headphones, CheckCircle } from 'lucide-react'

const ISSUE_TYPES = [
  'System Access / Login Issues',
  'Application Error / Crash',
  'Network / Connectivity Issue',
  'Hardware Issue (PC, Printer, etc.)',
  'Core Banking (Finacle) Issue',
  'Email / Outlook Issue',
  'Software Installation Request',
  'Security Concern / Suspicious Activity',
  'Other',
]

export default function ITSupport() {
  const [form, setForm] = useState({ issue_type: '', description: '', priority: 'medium', attachment: '' })
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      const ticketNum = `INC-${Math.floor(100000 + Math.random() * 900000)}`
      setSubmitted(ticketNum)
      setLoading(false)
    }, 800)
  }

  if (submitted) return (
    <div className="max-w-lg">
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-success" />
        </div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-2">Ticket Submitted</h2>
        <p className="text-sm text-text-secondary mb-4">Your IT support request has been received and assigned to the helpdesk team.</p>
        <div className="inline-block px-4 py-2 rounded-sm bg-bg-surface border border-border">
          <span className="text-xs text-text-muted">Ticket Number</span>
          <div className="font-mono font-bold text-text-primary mt-0.5">{submitted}</div>
        </div>
        <div className="mt-5 pt-4 border-t border-border text-xs text-text-muted space-y-1">
          <p>Estimated response: <strong className="text-text-secondary">Within 4 business hours</strong></p>
          <p>For urgent issues: <strong className="text-accent-primary">Ext. 4100</strong></p>
        </div>
        <button
          onClick={() => { setSubmitted(null); setForm({ issue_type: '', description: '', priority: 'medium', attachment: '' }) }}
          className="mt-4 px-4 py-2 rounded-sm text-sm text-text-muted hover:text-text-primary hover:bg-bg-surface transition-fast"
        >
          Submit Another Ticket
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Headphones size={18} className="text-accent-primary" />
        <h2 className="font-heading text-lg font-semibold text-text-primary">IT Support</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        {[
          { label: 'Emergency', value: 'Ext. 4100', note: '24/7 availability' },
          { label: 'Email', value: 'it.helpdesk@psb-internal.in', note: 'Non-urgent queries' },
          { label: 'Response Time', value: '4 hours', note: 'Business hours SLA' },
        ].map(c => (
          <div key={c.label} className="card-surface px-4 py-3">
            <div className="text-xs text-text-muted">{c.label}</div>
            <div className="text-sm font-semibold text-text-primary mt-0.5">{c.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{c.note}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-heading text-base font-semibold text-text-primary mb-4">Submit a Support Request</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Issue Type <span className="text-danger">*</span></label>
            <select
              required
              value={form.issue_type}
              onChange={e => setForm({ ...form, issue_type: e.target.value })}
              className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-fast"
            >
              <option value="">Select issue type…</option>
              {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description <span className="text-danger">*</span></label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue in detail. Include any error messages, steps to reproduce, and affected systems…"
              className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Priority</label>
            <div className="flex gap-3">
              {['low', 'medium', 'high'].map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`px-4 py-2 rounded-sm text-sm capitalize transition-fast border ${form.priority === p ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border text-text-muted hover:border-border-strong'}`}
                >{p}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Attachment (optional)</label>
            <input
              type="text"
              placeholder="Screenshot filename or file path"
              value={form.attachment}
              onChange={e => setForm({ ...form, attachment: e.target.value })}
              className="w-full px-3 py-2.5 rounded-sm bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-fast"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-sm bg-accent-primary text-text-inverse font-semibold text-sm transition-fast hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}
