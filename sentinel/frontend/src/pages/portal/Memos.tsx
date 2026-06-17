import { FileText, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const MEMOS = [
  { id: 'm1', from: 'Compliance Department', date: '22 May 2026', subject: 'Q1 Compliance Training Reminder — Completion Deadline 31st May', category: 'Compliance', priority: 'high', body: 'All employees are required to complete the Q1 compliance training modules on the LMS by 31st May 2026. Incomplete modules will be escalated to the Branch Manager and HR. Log in at lms.psb-internal.in with your employee credentials.' },
  { id: 'm2', from: 'Operations Team', date: '20 May 2026', subject: 'Updated KYC Procedures — Effective 1st June 2026', category: 'Operations', priority: 'medium', body: 'As per RBI Master Direction on KYC (updated April 2026), the following changes to KYC procedures are effective 1st June 2026: (1) Video-KYC now mandatory for high-risk customers. (2) Re-KYC interval reduced to 2 years for medium-risk profiles. Please review the updated SOP on the Policy Library portal.' },
  { id: 'm3', from: 'IT Department', date: '18 May 2026', subject: 'Core Banking System Downtime Notice — Saturday 25th May, 11 PM–2 AM', category: 'IT', priority: 'medium', body: 'The core banking system (Finacle) will be unavailable for scheduled maintenance on Saturday 25th May from 11:00 PM to 2:00 AM. Please complete all pending end-of-day transactions before 10:45 PM. Emergency IT support will be available at Ext. 4100.' },
  { id: 'm4', from: 'HR Department', date: '15 May 2026', subject: 'Performance Review Cycle Q1 FY2026-27 — Schedule Published', category: 'HR', priority: 'low', body: 'The Q1 performance review schedule has been published on the HR portal. Employees will receive their appraisal meeting invites from their respective managers by 20th May 2026. All self-assessments must be submitted on the HR portal by 25th May 2026.' },
  { id: 'm5', from: 'Branch Manager', date: '12 May 2026', subject: 'Revised Cash Handling Limits — Effective Immediately', category: 'Operations', priority: 'high', body: 'Effective immediately, the per-transaction cash handling limit for teller counters is revised to ₹2,00,000 (up from ₹1,50,000) as per the updated RBI circular. Any transaction exceeding this limit must be referred to the Senior Teller or Branch Manager for approval.' },
  { id: 'm6', from: 'Internal Audit', date: '10 May 2026', subject: 'Q4 FY2025-26 Audit Report — Branch Observations', category: 'Audit', priority: 'low', body: 'The Q4 FY2025-26 internal audit has been completed. The detailed report is available on the Audit portal. Branch staff are requested to review observations relevant to their roles and submit closure comments by 30th May 2026. Contact internal.audit@psb-internal.in for queries.' },
]

const CAT_COLORS: Record<string, string> = {
  Compliance: 'badge-warning', IT: 'badge-info', Operations: 'badge-neutral', HR: 'badge-success', Audit: 'badge-neutral',
}

export default function Memos() {
  const [selected, setSelected] = useState<typeof MEMOS[0] | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-accent-primary" />
        <h2 className="font-heading text-lg font-semibold text-text-primary">Internal Memos</h2>
        <span className="badge-neutral px-2 py-0.5 rounded-full text-xs">{MEMOS.length} memos</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2 card overflow-hidden divide-y divide-border">
          {MEMOS.map(memo => (
            <button
              key={memo.id}
              onClick={() => setSelected(memo)}
              className={`w-full text-left px-4 py-3.5 transition-fast hover:bg-bg-surface flex items-start gap-3 ${selected?.id === memo.id ? 'bg-accent-primary/5 border-l-2 border-accent-primary' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${CAT_COLORS[memo.category] ?? 'badge-neutral'} px-1.5 py-0.5 rounded text-xs font-medium`}>{memo.category}</span>
                  {memo.priority === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
                </div>
                <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">{memo.subject}</p>
                <p className="text-xs text-text-muted mt-1">{memo.from} · {memo.date}</p>
              </div>
              <ChevronRight size={14} className="text-text-muted mt-1 shrink-0" />
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`${CAT_COLORS[selected.category] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs font-medium`}>{selected.category}</span>
                {selected.priority === 'high' && <span className="badge-danger px-2 py-0.5 rounded text-xs font-medium">Priority</span>}
              </div>
              <h3 className="font-heading text-base font-semibold text-text-primary mb-2">{selected.subject}</h3>
              <div className="text-xs text-text-muted mb-4">From: {selected.from} · {selected.date}</div>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{selected.body}</div>
            </div>
          ) : (
            <div className="card p-5 flex items-center justify-center h-48 text-text-muted text-sm">
              Select a memo to read
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
