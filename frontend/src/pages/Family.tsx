import React, { useState, useEffect } from 'react';
import { familyAPI } from '../api';
import { Info } from 'lucide-react';

interface FamilyMember {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  spending_limit: number | null;
  joined_at: string;
  is_current_user: boolean;
}

interface FamilyData {
  is_member: boolean;
  family_id?: string;
  family_name?: string;
  head_user_id?: string;
  is_head?: boolean;
  my_role?: string;
  my_spending_limit?: number | null;
  members?: FamilyMember[];
  total_members?: number;
  message?: string;
}

interface PendingInvitation {
  invitation_id: string;
  inviter_name: string;
  inviter_email: string;
  family_name: string;
  created_at: string;
}

const Family: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [spendingLimit, setSpendingLimit] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    fetchFamily();
  }, []);

  const fetchFamily = async () => {
    setLoading(true);
    try {
      const [familyResponse, invitesResponse] = await Promise.all([
        familyAPI.getMyFamily(),
        familyAPI.getPendingInvitations()
      ]);
      setFamilyData(familyResponse.data);
      setPendingInvites(invitesResponse.data || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to load family' });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    try {
      await familyAPI.invite(inviteEmail);
      setMessage({ type: 'success', text: 'Invitation sent successfully' });
      setInviteEmail('');
      fetchFamily();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to send invitation' });
    }
  };

  const handleSetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    if (!selectedMember || !spendingLimit) {
      setMessage({ type: 'error', text: 'Please select a member and enter a limit' });
      return;
    }

    try {
      await familyAPI.setLimit(selectedMember, parseFloat(spendingLimit));
      setMessage({ type: 'success', text: 'Spending limit set successfully' });
      setSelectedMember('');
      setSpendingLimit('');
      fetchFamily();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to set limit' });
    }
  };

  const handleRespondInvite = async (invitationId: string, action: 'accept' | 'reject') => {
    setMessage(null);
    try {
      await familyAPI.respond(invitationId, action);
      setMessage({ type: 'success', text: `Invitation ${action}ed successfully` });
      fetchFamily();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || `Failed to ${action} invitation` });
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from family?`)) return;
    
    setMessage(null);
    try {
      await familyAPI.removeMember(memberUserId);
      setMessage({ type: 'success', text: 'Member removed successfully' });
      fetchFamily();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to remove member' });
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <h2> Family</h2>
          <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Family</h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}>
            <Info size={18} className="text-muted" style={{ cursor: 'help' }} />
            {showInfo && (
              <div style={{ position: 'absolute', top: 28, left: 0, width: 340, zIndex: 99999, padding: '16px', fontSize: '0.85rem', fontWeight: 'normal', color: '#E2E8F0', backgroundColor: '#1E1E2F', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: 8, fontSize: '0.95rem' }}>Family Glossary</strong>
                <strong style={{ color: '#818CF8' }}>Family Office</strong>: A centralized workspace to connect your family accounts securely and allocate digital capital.<br/><br/>
                <strong style={{ color: '#818CF8' }}>Spending Limits</strong>: As Family Head, you can strictly restrict the maximum disposable income other family members can spend per month.
              </div>
            )}
          </div>
        </div>
        
        {message && (
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            {message.text}
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <h3 style={{ marginBottom: '12px' }}>📬 Pending Invitations ({pendingInvites.length})</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {pendingInvites.map((invite) => (
                <div key={invite.invitation_id} style={{
                  padding: '12px',
                  background: 'white',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{invite.family_name}</strong>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      From: {invite.inviter_name} ({invite.inviter_email})
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleRespondInvite(invite.invitation_id, 'accept')}
                      style={{ padding: '6px 12px', fontSize: '14px' }}
                    >
                      Accept
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleRespondInvite(invite.invitation_id, 'reject')}
                      style={{ padding: '6px 12px', fontSize: '14px', background: 'var(--danger)', color: 'white' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!familyData?.is_member ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {familyData?.message || 'You are not part of any family'}
            </p>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '16px' }}>Create Your Family</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                Invite family members to manage spending together
              </p>
              
              <form onSubmit={handleInvite}>
                <div className="form-group">
                  <label>Member Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Send Invitation
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '8px' }}>{familyData.family_name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Your Role: <strong>{familyData.my_role}</strong>
                {familyData.my_spending_limit && (
                  <> • Spending Limit: <strong>₹{familyData.my_spending_limit.toLocaleString()}</strong></>
                )}
              </p>
            </div>

            {familyData.is_head && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Invite Member</h3>
                <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    Invite
                  </button>
                </form>
              </div>
            )}

            {familyData.is_head && familyData.members && familyData.members.length > 1 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Set Spending Limit</h3>
                <form onSubmit={handleSetLimit} style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Member</label>
                    <select
                      className="form-input"
                      value={selectedMember}
                      onChange={(e) => {
                        const memberId = e.target.value;
                        setSelectedMember(memberId);
                        // Pre-fill existing limit
                        const member = familyData.members?.find(m => m.user_id === memberId);
                        if (member?.spending_limit) {
                          setSpendingLimit(member.spending_limit.toString());
                        } else {
                          setSpendingLimit('');
                        }
                      }}
                      required
                    >
                      <option value="">Select member</option>
                      {familyData.members
                        .filter(m => m.role !== 'head' && m.status === 'active')
                        .map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name} ({m.email}){m.spending_limit ? ` - Current: ₹${m.spending_limit.toLocaleString()}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Limit (₹) {selectedMember && familyData.members?.find(m => m.user_id === selectedMember)?.spending_limit ? '(Update)' : '(New)'}</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="50000"
                      value={spendingLimit}
                      onChange={(e) => setSpendingLimit(e.target.value)}
                      min="1"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Set Limit
                  </button>
                </form>
              </div>
            )}

            <h3 style={{ marginBottom: '16px' }}>Family Members ({familyData.total_members})</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {familyData.members?.map((member) => (
                <div
                  key={member.user_id}
                  style={{
                    padding: '16px',
                    background: member.is_current_user ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                    border: member.is_current_user ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong>{member.full_name}</strong>
                      {member.role === 'head' && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'var(--accent-primary)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          Head
                        </span>
                      )}
                      {member.is_current_user && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'var(--success)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {member.email}
                    </div>
                    {member.spending_limit && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Limit: ₹{member.spending_limit.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '4px 12px',
                      background: member.status === 'active' ? '#d4edda' : '#fff3cd',
                      color: member.status === 'active' ? '#155724' : '#856404',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {member.status}
                    </div>
                    {familyData.is_head && member.role !== 'head' && !member.is_current_user && (
                      <button
                        className="btn"
                        onClick={() => handleRemoveMember(member.user_id, member.full_name)}
                        style={{ padding: '6px 12px', background: 'var(--danger)', color: 'white', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Family;
