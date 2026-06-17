import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { ArrowLeft, AlertTriangle, Flag } from 'lucide-react'

const MOCK_EMAILS: Record<string, any> = {
  'fake-001': {
    sender_name: 'HR Department', sender_email: 'hr@psb-internal.in',
    subject: 'Reminder: Annual Leave Balance Update — FY 2025-26',
    timestamp: '2026-05-24T09:15:00',
    body_html: '<p>Dear Team,</p><p>This is a reminder to review your annual leave balance before the end of Q2. Unused leave beyond the carry-forward limit will lapse on 30th September 2026.</p><p>Login to the HR portal to check your balance and apply for leave.</p><p>Regards,<br>HR Department<br>Punjab &amp; Sind Bank</p>',
  },
  'fake-002': {
    sender_name: 'IT Helpdesk', sender_email: 'helpdesk@psb-internal.in',
    subject: 'Action Required: Password Expiry in 30 Days',
    timestamp: '2026-05-23T14:30:00',
    body_html: '<p>Dear User,</p><p>This is an automated reminder that your network password will expire in <strong>30 days</strong> (25th June 2026).</p><p>Please reset your password by visiting the IT Self-Service Portal.</p><p>If you require assistance, raise a ticket via the IT Support portal.</p><p>IT Helpdesk<br>Punjab &amp; Sind Bank</p>',
  },
  'fake-003': {
    sender_name: 'Finance Team', sender_email: 'finance@psb-internal.in',
    subject: 'Expense Submission Deadline — 31st May 2026',
    timestamp: '2026-05-22T11:00:00',
    body_html: '<p>Dear All,</p><p>This is a reminder that all Q1 FY2026-27 expense reimbursement claims must be submitted via the Finance Portal by <strong>31st May 2026</strong>.</p><p>Claims submitted after the deadline will be processed in the next cycle. Please ensure all receipts are attached before submission.</p><p>Regards,<br>Finance Team</p>',
  },
  'fake-004': {
    sender_name: 'Branch Manager', sender_email: 'manager@psb-internal.in',
    subject: 'Team Meeting — Monday 27th May, 10:00 AM',
    timestamp: '2026-05-21T16:45:00',
    body_html: '<p>Team,</p><p>Quick reminder about our weekly sync meeting:</p><ul style="margin:8px 0 8px 20px"><li><strong>Date:</strong> Monday, 27th May 2026</li><li><strong>Time:</strong> 10:00 AM – 10:45 AM</li><li><strong>Venue:</strong> Conference Room B, Ground Floor</li></ul><p>Please come prepared with your weekly status update.</p><p>Regards,<br>Branch Manager</p>',
  },
  'fake-005': {
    sender_name: 'Compliance Team', sender_email: 'compliance@psb-internal.in',
    subject: 'Q2 Compliance Training — Enrollment Open',
    timestamp: '2026-05-20T08:00:00',
    body_html: '<p>Dear Employee,</p><p>The Q2 FY2026-27 mandatory compliance training modules are now open for enrollment on the Learning Management System.</p><p><strong>Modules to complete by 15th June 2026:</strong></p><ul style="margin:8px 0 8px 20px"><li>AML/CFT Refresher (45 min)</li><li>Data Privacy &amp; DPDP Act Overview (30 min)</li><li>Customer Due Diligence Update (20 min)</li></ul><p>Non-completion will be flagged to HR.</p><p>Compliance Team<br>Punjab &amp; Sind Bank</p>',
  },
}

export default function InboxDetail() {
  const { emailId } = useParams<{ emailId: string }>()
  const navigate = useNavigate()
  const [email, setEmail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reported, setReported] = useState(false)
  const [reportConfirm, setReportConfirm] = useState(false)

  useEffect(() => {
    if (!emailId) return
    if (MOCK_EMAILS[emailId]) {
      setEmail(MOCK_EMAILS[emailId])
      setLoading(false)
      return
    }
    client.get(`/portal/inbox/${emailId}`)
      .then(r => setEmail(r.data.data))
      .catch(() => setEmail(null))
      .finally(() => setLoading(false))
  }, [emailId])

  const handleReport = async () => {
    if (!reportConfirm) { setReportConfirm(true); return }
    try {
      await client.post(`/portal/inbox/${emailId}/report`)
      setReported(true)
    } catch {
      setReported(true)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-text-muted text-sm">Loading…</div>
  )
  if (!email) return (
    <div className="flex items-center justify-center h-48 text-text-muted text-sm">Message not found.</div>
  )

  const fmt = (ts: string) => new Date(ts).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/portal/inbox')} className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-fast">
        <ArrowLeft size={16} /> Back to Inbox
      </button>

      {/* Email card */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold text-text-primary mb-3">{email.subject}</h2>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                  <span className="text-xs font-semibold text-text-secondary">{email.sender_name?.[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{email.sender_name}</p>
                  <p className="text-xs text-text-muted">{email.sender_email}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted shrink-0">{fmt(email.timestamp)}</p>
          </div>
        </div>

        {/* Body */}
        <div
          className="px-6 py-5 text-sm text-text-secondary leading-relaxed prose-psb"
          style={{ lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: email.body_html ?? '<p>No content</p>' }}
        />

        {/* Toolbar */}
        <div className="px-6 py-3 border-t border-border flex items-center gap-3">
          {reported ? (
            <div className="flex items-center gap-2 text-xs text-success">
              <Flag size={13} /> Reported to IT Security. Thank you for your vigilance.
            </div>
          ) : reportConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-warning">Report this email as suspicious phishing?</span>
              <button onClick={handleReport} className="px-3 py-1.5 rounded-sm bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-fast">
                Yes, Report
              </button>
              <button onClick={() => setReportConfirm(false)} className="px-3 py-1.5 rounded-sm text-text-muted text-xs hover:bg-bg-surface transition-fast">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleReport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs text-text-muted hover:text-warning hover:bg-warning/10 transition-fast border border-border"
            >
              <AlertTriangle size={13} /> Report Suspicious Email
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
