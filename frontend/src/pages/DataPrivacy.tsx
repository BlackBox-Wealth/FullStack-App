import React from 'react';
import { Shield, Lock, Eye, Database, Server } from 'lucide-react';

const DataPrivacy: React.FC = () => {
  return (
    <div className="settings-page">
      <div className="page-header sticky-header">
        <div>
          <h2>Data Privacy & Security Centre</h2>
          <p>Review how WealthVault protects and manages your financial data using state-of-the-art encryption algorithms.</p>
        </div>
      </div>

      <div className="settings-grid" style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(300px, 1fr) 2fr' }}>
        <div className="settings-sidebar">
          <div className="card">
            <h3 className="card-title">Security Core</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Shield size={18} color="var(--success)" />
                <span>AES-256 Encryption Active</span>
              </li>
              <li style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Lock size={18} color="var(--accent-primary)" />
                <span>Homomorphic NLP Models ON</span>
              </li>
              <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eye size={18} color="var(--warning)" />
                <span>Zero-Knowledge Architecture</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="settings-content">
          <div className="card glass-premium">
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={20} className="text-primary" />
                Data Minimization Framework
              </h3>
            </div>
            <p className="text-secondary" style={{ lineHeight: 1.6, marginBottom: 20 }}>
              WealthVault leverages AI to optimize your wealth without ever selling or exposing your plaintext financial data. 
              Our proprietary <strong>Homomorphic Encryption</strong> proxy intercepts all sensitive values before transmission to inference layers.
            </p>
            <div className="alert-card info-card">
              <h4>What does this mean?</h4>
              <p>When our system generates behavioral insights regarding your ₹12,00,000 portfolio, the NLP engine physically cannot see "₹12,00,000". It computes directly over encrypted ciphertext tensors representing scale ranges without decrypting.</p>
            </div>
          </div>

          <div className="card glass-premium" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Server size={20} className="text-accent" />
                Your Consents
              </h3>
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div>
                <strong style={{ display: 'block', marginBottom: 4 }}>Account Aggregator (AA) Network</strong>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Allow API sync for real-time bank ledger reading. Revoking wipes historical ledger data.</span>
              </div>
              <button className="btn btn-secondary">Active</button>
            </div>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div>
                <strong style={{ display: 'block', marginBottom: 4 }}>LLM Conversational Telemetry</strong>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Utilize anonymized Homomorphic queries for behavioral nudges.</span>
              </div>
              <button className="btn btn-primary" style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' }}>Required</button>
            </div>
            
            <button className="btn btn-danger" style={{ marginTop: 12, width: '100%' }}>Request Complete Data Deletion (GDPR)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPrivacy;
