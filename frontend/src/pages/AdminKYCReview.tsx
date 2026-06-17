import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { useAuthStore } from '../store';
import PageLoader from '../components/animation/PageLoader';

const AdminKYCReview: React.FC = () => {
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const userRole = useAuthStore(s => s.user?.role);
    const isRM = userRole === 'relationship_manager' || userRole === 'super_admin';

    useEffect(() => {
        loadData();
    }, [userRole]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = isRM 
                ? await adminAPI.getEscalatedKYC() 
                : await adminAPI.getPendingKYC();
            setDocs(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string) => {
        if (!selectedDoc) return;
        setActionLoading(true);
        try {
            await adminAPI.kycAction(selectedDoc.user_id, action, comments);
            setSelectedDoc(null);
            setComments('');
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <PageLoader label="Loading KYC reviews" />;

    return (
        <div className="admin-kyc" style={{ padding: 20 }}>
            <div className="page-header">
                <div>
                    <h2>{isRM ? 'Escalated KYC Reviews' : 'Pending KYC Verifications'}</h2>
                    <p>{docs.length} cases waiting for action</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '300px 1fr' : '1fr', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {docs.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                            <div style={{ fontSize: '3rem' }}>✨</div>
                            <p>No pending cases!</p>
                        </div>
                    ) : (
                        docs.map(doc => (
                            <div 
                                key={doc.id} 
                                className={`card ${selectedDoc?.id === doc.id ? 'active' : ''}`} 
                                style={{ padding: 16, cursor: 'pointer', border: selectedDoc?.id === doc.id ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}
                                onClick={() => setSelectedDoc(doc)}
                            >
                                <h4 style={{ margin: 0 }}>{doc.full_name}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{doc.email}</p>
                                <div style={{ marginTop: 8, fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    Score: {doc.extracted_data.match_score}%
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {selectedDoc && (
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3>Review: {selectedDoc.full_name}</h3>
                            <button className="btn btn-sm" onClick={() => setSelectedDoc(null)}>✕ Close</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <div>
                                <h4 style={{ marginBottom: 12 }}>Documents</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Aadhaar (Front & Back)</p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <img src={selectedDoc.aadhaar_front} alt="Aadhaar Front" style={{ width: '48%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                                            <img src={selectedDoc.aadhaar_back} alt="Aadhaar Back" style={{ width: '48%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>PAN Card</p>
                                        <img src={selectedDoc.pan} alt="PAN Card" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ marginBottom: 12 }}>AI Extraction Analysis</h4>
                                <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12 }}>
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Match/Confidence Score</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ flex: 1, height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
                                                <div style={{ 
                                                    width: `${selectedDoc.extracted_data.confidence_score}%`, 
                                                    height: '100%', 
                                                    background: selectedDoc.extracted_data.confidence_score > 80 ? '#10b981' : selectedDoc.extracted_data.confidence_score > 50 ? '#f59e0b' : '#ef4444' 
                                                }}></div>
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selectedDoc.extracted_data.confidence_score}%</span>
                                        </div>
                                    </div>

                                    {selectedDoc.extracted_data.flags && selectedDoc.extracted_data.flags.length > 0 && (
                                        <div style={{ marginBottom: 16 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Fraud & Validation Flags</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {selectedDoc.extracted_data.flags.map((flag: string, i: number) => (
                                                    <div key={i} style={{ 
                                                        padding: '6px 12px', 
                                                        borderRadius: 6, 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 600,
                                                        background: flag.includes('CRITICAL') || flag.includes('ERROR') ? '#fef2f2' : '#fffbeb',
                                                        color: flag.includes('CRITICAL') || flag.includes('ERROR') ? '#991b1b' : '#92400e',
                                                        border: `1px solid ${flag.includes('CRITICAL') || flag.includes('ERROR') ? '#fecaca' : '#fef3c7'}`
                                                    }}>
                                                        {flag}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Aadhaar Number</label>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedDoc.extracted_data.Aadhaar?.fields?.raw || 'Not Found'}</p>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PAN Number</label>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedDoc.extracted_data.PAN?.fields?.raw || 'Not Found'}</p>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', borderTop: '1px solid #eee', paddingTop: 12 }}>
                                        "Engine Analysis: {selectedDoc.extracted_data.analysis || 'Ready for review'}"
                                    </div>
                                </div>

                                <div style={{ marginTop: 24 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>Reviewer Comments</label>
                                    <textarea 
                                        className="form-input" 
                                        rows={3} 
                                        placeholder="Add notes for the user or manager..."
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                        style={{ width: '100%', marginBottom: 16 }}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <button className="btn btn-success" onClick={() => handleAction('accept')} disabled={actionLoading}>Accept</button>
                                        <button className="btn btn-danger" onClick={() => handleAction('reject')} disabled={actionLoading}>✕ Reject</button>
                                        <button className="btn btn-warning" onClick={() => handleAction('request_reupload')} disabled={actionLoading}>Ask Clear Pic</button>
                                        {!isRM && (
                                            <button className="btn btn-primary" onClick={() => handleAction('escalate')} disabled={actionLoading}>Escalate</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminKYCReview;
