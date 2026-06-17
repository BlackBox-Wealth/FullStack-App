import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';

interface KYCGuardProps {
    children: React.ReactNode;
}

const KYCGuard: React.FC<KYCGuardProps> = ({ children }) => {
    const { user } = useAuthStore();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const isVerified = user?.kyc_status === 'verified' || user?.kyc_status === 'Verified';

    // If super_admin or employee, or verified customer, skip guard
    if (
        user?.role === 'super_admin' || 
        user?.role === 'employee' || 
        user?.role === 'relationship_manager' ||
        isVerified
    ) {
        return <>{children}</>;
    }

    let message = t('kyc.required');
    let subMessage = t('kyc.notInitiated');
    let icon = "ID";

    if (user?.kyc_status === 'pending') {
        message = t('kyc.progress');
        subMessage = t('kyc.reviewing');
        icon = "...";
    } else if (user?.kyc_status === 'rejected' || user?.kyc_status === 'reupload_requested') {
        message = t('kyc.rejected');
        subMessage = t('kyc.reupload');
        icon = "X";
    } else if (user?.kyc_status === 'not_initiated' || !user?.kyc_status) {
        message = t('kyc.required');
        subMessage = t('kyc.notInitiated');
        icon = "...";
    }

    return (
        <div className="card" style={{ 
            maxWidth: 600, 
            margin: '60px auto', 
            textAlign: 'center', 
            padding: '40px 24px',
            borderTop: '4px solid var(--primary)'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: 20 }}>{icon}</div>
            <h2 style={{ marginBottom: 12 }}>{message}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '1.1rem', lineHeight: 1.6 }}>
                {subMessage}
            </p>
            <button 
                className="btn btn-primary btn-lg" 
                onClick={() => navigate('/kyc')}
                style={{ minWidth: 240 }}
            >
                {t('kyc.goVerify')}
            </button>
        </div>
    );
};

export default KYCGuard;
