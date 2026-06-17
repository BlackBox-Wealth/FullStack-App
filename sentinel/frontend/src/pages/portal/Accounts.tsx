import { CreditCard } from 'lucide-react'

const ACCOUNTS = [
  { label: 'Salary Account', number: 'XXXX XXXX 4821', balance: '₹2,14,350.00', type: 'Savings', status: 'Active' },
  { label: 'Provident Fund', number: 'PF-0042-8219', balance: '₹8,92,100.00', type: 'PF Account', status: 'Active' },
]

export default function Accounts() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard size={18} className="text-accent-primary" />
        <h2 className="font-heading text-lg font-semibold text-text-primary">My Accounts</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACCOUNTS.map(acc => (
          <div key={acc.number} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-muted">{acc.type}</span>
              <span className="badge-success px-2 py-0.5 rounded-full text-xs">{acc.status}</span>
            </div>
            <div className="font-heading text-xl font-bold text-text-primary mb-1">{acc.balance}</div>
            <div className="text-sm text-text-secondary mb-0.5">{acc.label}</div>
            <div className="text-xs text-text-muted font-mono">{acc.number}</div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="font-heading text-sm font-semibold text-text-primary mb-4">Recent Transactions</h3>
        <div className="space-y-3">
          {[
            { desc: 'Salary Credit — May 2026', amount: '+₹68,500', date: '01 May 2026', type: 'credit' },
            { desc: 'LIC Premium Debit', amount: '-₹4,200', date: '05 May 2026', type: 'debit' },
            { desc: 'ATM Withdrawal', amount: '-₹10,000', date: '12 May 2026', type: 'debit' },
            { desc: 'Incentive Credit Q4', amount: '+₹12,000', date: '18 May 2026', type: 'credit' },
          ].map((tx, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-text-primary">{tx.desc}</p>
                <p className="text-xs text-text-muted">{tx.date}</p>
              </div>
              <span className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>{tx.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
