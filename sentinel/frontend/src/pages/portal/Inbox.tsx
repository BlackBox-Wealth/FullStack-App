import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { Inbox as InboxIcon, RefreshCw } from 'lucide-react'

interface Email {
  email_id: string
  sender_name: string
  sender_email: string
  subject: string
  preview: string
  timestamp: string
  read: boolean
}

const MOCK_EMAILS: Email[] = [
  { email_id: 'fake-001', sender_name: 'HR Department', sender_email: 'hr@psb-internal.in', subject: 'Reminder: Annual Leave Balance Update — FY 2025-26', preview: 'Please review your leave balance before the quarter closes...', timestamp: '2026-05-24T09:15:00', read: true },
  { email_id: 'fake-002', sender_name: 'IT Helpdesk', sender_email: 'helpdesk@psb-internal.in', subject: 'Action Required: Password Expiry in 30 Days', preview: 'Your system password will expire on 25th June 2026. Please reset it...', timestamp: '2026-05-23T14:30:00', read: true },
  { email_id: 'fake-003', sender_name: 'Finance Team', sender_email: 'finance@psb-internal.in', subject: 'Expense Submission Deadline — 31st May 2026', preview: 'All Q1 expense claims must be submitted by 31st May. Late submissions will not be processed...', timestamp: '2026-05-22T11:00:00', read: false },
  { email_id: 'fake-004', sender_name: 'Branch Manager', sender_email: 'manager@psb-internal.in', subject: 'Team Meeting — Monday 27th May, 10:00 AM', preview: 'Quick reminder about our weekly sync. Please come prepared with your weekly status...', timestamp: '2026-05-21T16:45:00', read: false },
  { email_id: 'fake-005', sender_name: 'Compliance Team', sender_email: 'compliance@psb-internal.in', subject: 'Q2 Compliance Training — Enrollment Open', preview: 'The Q2 mandatory compliance training modules are now open for enrollment...', timestamp: '2026-05-20T08:00:00', read: true },
]

export default function Inbox() {
  const [emails, setEmails] = useState<Email[]>(MOCK_EMAILS)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    client.get('/portal/inbox')
      .then(r => setEmails(r.data.data?.emails ?? MOCK_EMAILS))
      .catch(() => setEmails(MOCK_EMAILS))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const fmt = (ts: string) => {
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InboxIcon size={18} className="text-accent-primary" />
          <h2 className="font-heading text-lg font-semibold text-text-primary">Internal Mail</h2>
          <span className="badge-info px-2 py-0.5 rounded-full text-xs font-medium">
            {emails.filter(e => !e.read).length} unread
          </span>
        </div>
        <button onClick={load} className="w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-fast">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Email list */}
      <div className="card overflow-hidden divide-y divide-border">
        {emails.map(email => (
          <button
            key={email.email_id}
            onClick={() => navigate(`/portal/inbox/${email.email_id}`)}
            className={`w-full text-left px-5 py-4 hover:bg-bg-surface transition-fast flex items-start gap-4 ${!email.read ? 'bg-accent-primary/5' : ''}`}
          >
            {/* Unread dot */}
            <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: email.read ? 'transparent' : 'var(--color-accent-primary)' }} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-sm ${!email.read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                  {email.sender_name}
                </span>
                <span className="text-xs text-text-muted shrink-0">{fmt(email.timestamp)}</span>
              </div>
              <div className={`text-sm mb-0.5 ${!email.read ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                {email.subject}
              </div>
              <div className="text-xs text-text-muted truncate">{email.preview}</div>
            </div>
          </button>
        ))}

        {emails.length === 0 && (
          <div className="px-5 py-12 text-center text-text-muted">
            <InboxIcon size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No messages in your inbox</p>
          </div>
        )}
      </div>
    </div>
  )
}
