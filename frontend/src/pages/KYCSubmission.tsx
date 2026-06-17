import React, { useState, useEffect } from 'react';
import { kycAPI } from '../api';
import { useAuthStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import { HelpCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLoader from '../components/animation/PageLoader';

// Verhoeff Algorithm Tables
const dTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const pTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const validateAadhaar = (number: string): boolean => {
    if (!number || !/^\d{12}$/.test(number)) {
        return false;
    }
    let c = 0;
    const reversed = number.split('').reverse();
    for (let i = 0; i < reversed.length; i++) {
        c = dTable[c][pTable[i % 8][parseInt(reversed[i], 10)]];
    }
    return c === 0;
};

const KYCSubmission: React.FC = () => {
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
    const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
    const [pan, setPan] = useState<string | null>(null);
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await kycAPI.getStatus();
            setStatus(res.data);
            if (res.data.status === 'verified') {
                // Redirect if already verified?
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setter(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!aadhaarFront || !aadhaarBack || !pan) {
            const msg = "Please upload all required documents";
            setError(msg);
            toast.error(msg);
            return;
        }

        if (!aadhaarNumber || !panNumber) {
            const msg = "Please provide both your Aadhaar number and PAN number.";
            setError(msg);
            toast.error(msg);
            return;
        }

        if (!validateAadhaar(aadhaarNumber)) {
            const msg = "The Aadhaar number provided is invalid according to official checksums. Please verify.";
            setError(msg);
            toast.error(msg);
            return;
        }

        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
            const msg = "The PAN number format is invalid. Ensure it is exactly 10 characters (e.g., ABCDE1234F).";
            setError(msg);
            toast.error(msg);
            return;
        }

        setUploading(true);
        setError(null);
        try {
            await kycAPI.upload(aadhaarFront, aadhaarBack, pan, aadhaarNumber, panNumber);
            toast.success("Documents successfully submitted for verification!");
            fetchStatus();
        } catch (err: any) {
            const errMsg = err.response?.data?.detail || "Upload failed";
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <PageLoader label="Loading KYC status" />;

    if (status?.status === 'pending_review' || status?.status === 'escalated') {
        return (
            <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 20 }}>Pending</div>
                <h2 style={{ marginBottom: 12 }}>KYC Under Review</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                    Your documents have been submitted and are currently being verified by our team. 
                    This usually takes 24-48 hours.
                </p>
                <div className="badge badge-warning" style={{ padding: '8px 16px', fontSize: '1rem' }}>
                    {status.status === 'escalated' ? 'Escalated to Manager' : 'Pending Review'}
                </div>
            </div>
        );
    }

    if (status?.status === 'verified') {
        return (
            <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 20 }}>Verified</div>
                <h2 style={{ marginBottom: 12 }}>KYC Verified</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                    Congratulations! Your identity has been successfully verified. 
                    You now have full access to all banking features.
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
            </div>
        );
    }

    const isNotInitiated = status?.status === 'not_initiated' || status?.status === 'none' || !status?.status;

    return (
        <div className="kyc-page" style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
            <div className="page-header">
                <div>
                    <h2>Identity Verification (KYC)</h2>
                    <p>Upload your documents to unlock premium banking features.</p>
                </div>
            </div>

            {isNotInitiated && (
                <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                    <strong>KYC Required:</strong> Your verification has not been initiated. Upload documents to start review.
                </div>
            )}

            {status?.status === 'reupload_requested' && (
                <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                    <strong style={{ color: '#ef4444' }}>Action Required:</strong> {status.comments || "Please re-upload clearer documents."}
                </div>
            )}

            {error && (
                <div 
                    style={{ 
                        marginBottom: 24, 
                        padding: '16px 20px', 
                        backgroundColor: '#fef2f2', 
                        border: '2px solid #ef4444', 
                        color: '#b91c1c', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        fontWeight: 600,
                        gap: '12px',
                        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1), 0 2px 4px -1px rgba(239, 68, 68, 0.06)'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <h4 style={{ marginBottom: 16 }}>Identification Numbers</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div className="form-group">
                        <label className="form-label">Aadhaar Number <span style={{color:'red'}}>*</span></label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="0000 0000 0000" 
                            maxLength={12} 
                            value={aadhaarNumber} 
                            onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} 
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Must be exactly 12 digits</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">PAN Number <span style={{color:'red'}}>*</span></label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="ABCDE1234F" 
                            maxLength={10} 
                            value={panNumber} 
                            onChange={e => setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Standard 10-character PAN format</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h4 style={{ marginBottom: 16 }}>Aadhaar Card (Front)</h4>
                    <div className="upload-box" style={{ 
                        border: '2px dashed var(--border-color)', 
                        borderRadius: 12, 
                        height: 180, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {aadhaarFront ? (
                            <img src={aadhaarFront} alt="Aadhaar Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1rem', marginBottom: 8 }}>Aadhaar Front</div>
                                <p>Click to upload front</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleFileChange(e, setAadhaarFront)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h4 style={{ marginBottom: 16 }}>Aadhaar Card (Back)</h4>
                    <div className="upload-box" style={{ 
                        border: '2px dashed var(--border-color)', 
                        borderRadius: 12, 
                        height: 180, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {aadhaarBack ? (
                            <img src={aadhaarBack} alt="Aadhaar Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1rem', marginBottom: 8 }}>Aadhaar Back</div>
                                <p>Click to upload back</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleFileChange(e, setAadhaarBack)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                    </div>
                </div>

                <div className="card" style={{ padding: 20, gridColumn: 'span 2' }}>
                    <h4 style={{ marginBottom: 16 }}>PAN Card</h4>
                    <div className="upload-box" style={{ 
                        border: '2px dashed var(--border-color)', 
                        borderRadius: 12, 
                        height: 200, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {pan ? (
                            <img src={pan} alt="PAN Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1rem', marginBottom: 8 }}>PAN</div>
                                <p>Click to upload PAN Card</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleFileChange(e, setPan)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ textAlign: 'center' }}>
                <button 
                    className="btn btn-primary btn-lg" 
                    style={{ minWidth: 200 }}
                    onClick={handleSubmit}
                    disabled={uploading || !aadhaarFront || !aadhaarBack || !pan}
                >
                    {uploading ? 'Submitting documents...' : 'Submit Documents'}
                </button>
                <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Your documents are encrypted and stored securely.
                </p>
            </div>

            <div className="card" style={{ marginTop: 40, padding: 24, border: '1px solid var(--accent-primary)', background: 'rgba(15, 118, 110, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <HelpCircle size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0 }}>Have questions about KYC?</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Our AI Compliance Assistant can explain the RBI policies and requirements.</p>
                    </div>
                </div>
                <Link to="/support" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Talk to Assistant <ChevronRight size={16} />
                </Link>
            </div>
        </div>
    );
};

export default KYCSubmission;
