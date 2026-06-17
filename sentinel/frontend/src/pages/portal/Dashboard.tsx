import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import client from '../../api/client'
import { CheckSquare, Inbox, Wrench, FileText, Calendar, Bell, ExternalLink } from 'lucide-react'

const ICON_MAP: Record<string, any> = { wrench: Wrench, file: FileText, calendar: Calendar, bell: Bell }

const MOCK_DATA = {
  employee: { name: 'Ananya Sharma', role: 'Teller', department: 'Retail Banking', employee_id: 'EMP-4021' },
  pending_approvals: 7,
  activity_feed: [
    { icon: 'wrench', text: 'System maintenance scheduled Sunday 02:00–04:00 AM.', time: '2h ago' },
    { icon: 'file', text: 'Updated KYC procedure circular issued by Compliance Team.', time: '1d ago' },
    { icon: 'calendar', text: 'End of quarter reporting deadline: 31st May 2026.', time: '2d ago' },
    { icon: 'bell', text: 'New RBI circular on UPI transaction limits — review mandatory.', time: '3d ago' },
  ],
  quick_links: [
    { label: 'HR Portal', url: '#' },
    { label: 'IT Support', url: '/portal/it-support' },
    { label: 'Expense Claims', url: '#' },
    { label: 'Policy Library', url: '#' },
  ],
  unread_mail_count: 3,
}

export default function PortalDashboard() {
  const [data, setData] = useState(MOCK_DATA)
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()

  useEffect(() => {
    client.get('/portal/dashboard')
      .then(r => setData({ ...MOCK_DATA, ...r.data.data, employee: { ...MOCK_DATA.employee, name: r.data.data?.employee?.name ?? user?.name ?? MOCK_DATA.employee.name } }))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted mb-0.5">Good morning,</p>
          <h2 className="font-heading text-xl font-bold text-text-primary">{data.employee.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="badge-info px-2 py-0.5 rounded-sm text-xs font-medium">{data.employee.department}</span>
            <span className="text-xs text-text-muted">{data.employee.employee_id}</span>
          </div>
        </div>
        <div className="text-right text-xs text-text-muted">
          <div>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/portal/approvals')}
          className="card p-4 text-left hover:border-accent-primary/40 transition-fast"
        >
          <CheckSquare size={18} className="text-warning mb-2" />
          <div className="font-heading text-2xl font-bold text-text-primary">{data.pending_approvals}</div>
          <div className="text-xs text-text-muted mt-0.5">Pending Approvals</div>
        </button>

        <button
          onClick={() => navigate('/portal/inbox')}
          className="card p-4 text-left hover:border-accent-primary/40 transition-fast"
        >
          <Inbox size={18} className="text-accent-primary mb-2" />
          <div className="font-heading text-2xl font-bold text-text-primary">{data.unread_mail_count}</div>
          <div className="text-xs text-text-muted mt-0.5">Unread Messages</div>
        </button>

        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">KYC Pending</div>
          <div className="font-heading text-2xl font-bold text-text-primary">3</div>
          <div className="text-xs text-text-muted mt-0.5">Reviews Today</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Transactions</div>
          <div className="font-heading text-2xl font-bold text-text-primary">142</div>
          <div className="text-xs text-text-muted mt-0.5">Processed Today</div>
        </div>
      </div>

      {/* Activity + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity feed */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-heading text-base font-semibold text-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {data.activity_feed.map((item, i) => {
              const Icon = ICON_MAP[item.icon] ?? Bell
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-sm bg-bg-surface flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-text-primary leading-snug">{item.text}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="card p-5">
          <h3 className="font-heading text-base font-semibold text-text-primary mb-4">Quick Links</h3>
          <div className="space-y-2">
            {data.quick_links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                onClick={link.url !== '#' ? (e) => { e.preventDefault(); navigate(link.url) } : undefined}
                className="flex items-center justify-between px-3 py-2.5 rounded-sm bg-bg-surface hover:bg-bg-surface/80 transition-fast group"
              >
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-fast">{link.label}</span>
                <ExternalLink size={12} className="text-text-muted" />
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-text-muted">Need help?</p>
            <p className="text-xs text-accent-primary font-medium mt-0.5">IT Helpdesk — Ext. 4100</p>
          </div>
        </div>
      </div>
    </div>
  )
}
