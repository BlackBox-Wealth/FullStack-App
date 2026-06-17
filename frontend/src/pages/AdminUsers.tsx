import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { useAuthStore } from '../store';
import PageLoader from '../components/animation/PageLoader';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const { user: currentUser } = useAuthStore();

  useEffect(() => { loadUsers(); }, [roleFilter]);

  const loadUsers = async () => {
    try {
      const params: any = {};
      if (roleFilter) params.role = roleFilter;
      const res = await adminAPI.getUsers(params);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDeactivate = async (userId: string) => {
    await adminAPI.deactivateUser(userId);
    loadUsers();
  };

  const handleActivate = async (userId: string) => {
    await adminAPI.activateUser(userId);
    loadUsers();
  };

  if (loading) return <PageLoader label="Loading users" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p>{total} total users</p>
        </div>
        <select className="form-select" style={{ width: 180 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} id="user-role-filter">
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="employee">Employees</option>
          <option value="relationship_manager">Relationship Managers</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>KYC</th>
                <th>Status</th>
                {currentUser?.role === 'super_admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--accent-gradient)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.75rem', color: 'white'
                      }}>
                        {u.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td><span style={{ textTransform: 'capitalize', color: 'var(--accent-primary)', fontWeight: 600 }}>{u.role?.replace('_', ' ')}</span></td>
                  <td><span className={`badge-status ${u.kyc_status}`}>{u.kyc_status}</span></td>
                  <td><span className={`badge-status ${u.is_active ? 'active' : 'frozen'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  {currentUser?.role === 'super_admin' && (
                    <td>
                      {u.is_active ? (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(u.id)}>Deactivate</button>
                      ) : (
                        <button className="btn btn-sm btn-success" onClick={() => handleActivate(u.id)}>Activate</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
