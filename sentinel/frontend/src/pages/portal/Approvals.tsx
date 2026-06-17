import { CheckSquare, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

const APPROVALS = [
  { id: 'A001', type: 'Loan Disbursement', customer: 'Ramesh Gupta', amount: '₹5,00,000', requested: '22 May 2026', priority: 'high', status: 'pending' },
  { id: 'A002', type: 'KYC Verification', customer: 'Priya Mehta', amount: '-', requested: '23 May 2026', priority: 'medium', status: 'pending' },
  { id: 'A003', type: 'FD Premature Closure', customer: 'Suresh Patel', amount: '₹2,40,000', requested: '21 May 2026', priority: 'low', status: 'pending' },
  { id: 'A004', type: 'Account Limit Override', customer: 'Anjali Singh', amount: '₹1,50,000', requested: '20 May 2026', priority: 'high', status: 'pending' },
  { id: 'A005', type: 'Cheque Book Issue', customer: 'Mohan Rao', amount: '-', requested: '19 May 2026', priority: 'low', status: 'pending' },
  { id: 'A006', type: 'NEFT Transfer', customer: 'Kavita Sharma', amount: '₹75,000', requested: '18 May 2026', priority: 'medium', status: 'approved' },
  { id: 'A007', type: 'Loan Disbursement', customer: 'Dinesh Kumar', amount: '₹3,00,000', requested: '17 May 2026', priority: 'medium', status: 'rejected' },
]

export default function Approvals() {
  const [statuses, setStatuses] = useState<Record<string, string>>(Object.fromEntries(APPROVALS.map(a => [a.id, a.status])))

  const approve = (id: string) => setStatuses(s => ({ ...s, [id]: 'approved' }))
  const reject = (id: string) => setStatuses(s => ({ ...s, [id]: 'rejected' }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckSquare size={18} className="text-accent-primary" />
        <h2 className="font-heading text-lg font-semibold text-text-primary">Pending Approvals</h2>
        <span className="badge-warning px-2 py-0.5 rounded-full text-xs font-medium">
          {Object.values(statuses).filter(s => s === 'pending').length} pending
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Requested</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {APPROVALS.map(a => {
              const st = statuses[a.id]
              return (
                <tr key={a.id} className="hover:bg-bg-surface transition-fast">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{a.id}</td>
                  <td className="px-4 py-3 text-text-primary">{a.type}</td>
                  <td className="px-4 py-3 text-text-secondary">{a.customer}</td>
                  <td className="px-4 py-3 text-text-secondary">{a.amount}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.requested}</td>
                  <td className="px-4 py-3">
                    {st === 'pending' && <span className="flex items-center gap-1 text-warning text-xs"><Clock size={12} /> Pending</span>}
                    {st === 'approved' && <span className="flex items-center gap-1 text-success text-xs"><CheckCircle size={12} /> Approved</span>}
                    {st === 'rejected' && <span className="flex items-center gap-1 text-danger text-xs"><XCircle size={12} /> Rejected</span>}
                  </td>
                  <td className="px-4 py-3">
                    {st === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => approve(a.id)} className="px-2.5 py-1 rounded text-xs bg-success/10 text-success hover:bg-success/20 transition-fast">Approve</button>
                        <button onClick={() => reject(a.id)} className="px-2.5 py-1 rounded text-xs bg-danger/10 text-danger hover:bg-danger/20 transition-fast">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
