import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';

const AdminAudit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const res = await adminAPI.getAuditLogs();
      setLogs(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📋 Audit Logs</h2>
          <p>System activity and change history</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Performed By</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem' }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {log.action?.replace('_', ' ')}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{log.performed_by}</td>
                  <td style={{ fontSize: '0.85rem' }}>{log.target_user || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {log.new_role && `Role → ${log.new_role}`}
                    {log.status && `Status → ${log.status}`}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><p>No audit logs yet</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAudit;
