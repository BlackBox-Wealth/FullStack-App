import React, { useEffect, useState } from 'react';
import { transactionsAPI } from '../api';

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    try {
      const params: any = { limit: 100 };
      if (filter) params.category = filter;
      const res = await transactionsAPI.getAll(params);
      setTransactions(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const categories = ['salary', 'food', 'shopping', 'bills', 'entertainment', 'travel', 'healthcare', 'education', 'investment', 'transfer', 'other'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Transactions</h2>
          <p>View your transaction history</p>
        </div>
        <select
          className="form-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 200 }}
          id="txn-category-filter"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c} style={{ textTransform: 'capitalize' }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td style={{ fontSize: '0.8rem' }}>
                    {new Date(txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{txn.description || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{txn.category}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: txn.transaction_type === 'credit' ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {txn.transaction_type === 'credit' ? '↑' : '↓'} {txn.transaction_type}
                    </span>
                  </td>
                  <td className={txn.transaction_type === 'credit' ? 'amount-credit' : 'amount-debit'} style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {txn.transaction_type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: txn.risk_score > 0.7 ? 'var(--danger)' : txn.risk_score > 0.4 ? 'var(--warning)' : 'var(--success)'
                      }} />
                      <span style={{ fontSize: '0.8rem' }}>{(txn.risk_score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td><span className={`badge-status ${txn.status}`}>{txn.status}</span></td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><p>No transactions found</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
