import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck, ChevronRight } from 'lucide-react';
import { usePhishingStore } from '../store';
import {
  trackPageEnter, trackPageLeave, trackFormFocus,
  trackFormInput, trackFormSubmit, trackCredentialsSubmitted,
  trackTaskCompleted, adjustScore,
} from '../tracker';

type Step = 1 | 2 | 3;

const Task: React.FC = () => {
  const { context, user } = usePhishingStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [form, setForm] = useState({
    employee_id: user?.employee_id || '',
    full_name: user?.name || '',
    department: user?.department || '',
    designation: '',
    email: user?.email || '',
    phone: '',
    account_number: '',
    ifsc: '',
    current_password: '',
    new_password: '',
  });

  useEffect(() => {
    trackPageEnter('/task');
    adjustScore(-10); // reached the task form
    return () => trackPageLeave('/task');
  }, []);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    const sensitive = ['account_number', 'ifsc', 'current_password', 'new_password'];
    trackFormInput(field, sensitive.includes(field));
  };

  const handleFocus = (field: string) => () => {
    trackFormFocus(field);
  };

  const handleNext = () => {
    if (step < 3) setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    trackFormSubmit('hr_declaration', Object.keys(form));
    trackCredentialsSubmitted();
    trackTaskCompleted('annual_hr_declaration');

    // simulate network delay
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);

    usePhishingStore.getState().triggerReveal();
  };

  const harvestType = context?.harvest_page_type || 'hr_portal';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>{context?.task_title || 'Annual HR Declaration'}</h2>
          <p>Complete all fields and submit. This should take about 5 minutes.</p>
        </div>
      </div>

      {/* Progress steps */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginBottom: 28,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          padding: '16px 24px',
        }}
      >
        {(['Personal Details', 'Bank Details', 'Security Verification'] as const).map((label, i) => {
          const idx = i + 1;
          const done = step > idx;
          const active = step === idx;
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: done ? 'var(--success)' : active ? 'var(--accent-primary)' : 'var(--bg-input)',
                    color: done || active ? 'white' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : idx}
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: done ? 'var(--success)' : 'var(--border-color)',
                    margin: '0 8px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          {step === 1 && (
            <div>
              <div className="card-header">
                <div>
                  <div className="card-title">Personal Information</div>
                  <div className="card-subtitle">Verify and update your staff details</div>
                </div>
                <ShieldCheck size={22} color="var(--accent-primary)" />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input
                    className="form-input"
                    value={form.employee_id}
                    onChange={handleChange('employee_id')}
                    onFocus={handleFocus('employee_id')}
                    required
                    placeholder="PSB/EMP/XXXX"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    value={form.full_name}
                    onChange={handleChange('full_name')}
                    onFocus={handleFocus('full_name')}
                    required
                    placeholder="As per records"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={form.department}
                    onChange={handleChange('department')}
                    onFocus={handleFocus('department')}
                    required
                  >
                    <option value="">Select department…</option>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Risk">Risk &amp; Compliance</option>
                    <option value="Customer Service">Customer Service</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    className="form-input"
                    value={form.designation}
                    onChange={handleChange('designation')}
                    onFocus={handleFocus('designation')}
                    required
                    placeholder="e.g. Senior Officer"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Official Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    onFocus={handleFocus('email')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    onFocus={handleFocus('phone')}
                    required
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="card-header">
                <div>
                  <div className="card-title">Salary Bank Account Details</div>
                  <div className="card-subtitle">Verify your salary credit account for HR records</div>
                </div>
                <Lock size={22} color="var(--accent-primary)" />
              </div>

              <div
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid rgba(37,99,235,0.2)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: '0.82rem',
                  color: 'var(--info)',
                }}
              >
                🔒 Your bank details are encrypted and used only for HR payroll verification.
              </div>

              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Account Number</label>
                  <input
                    className="form-input"
                    value={form.account_number}
                    onChange={handleChange('account_number')}
                    onFocus={handleFocus('account_number')}
                    required
                    placeholder="Enter account number"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    className="form-input"
                    value={form.ifsc}
                    onChange={handleChange('ifsc')}
                    onFocus={handleFocus('ifsc')}
                    required
                    placeholder="e.g. PSIB0000001"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    className="form-input"
                    defaultValue="Punjab &amp; Sind Bank"
                    readOnly
                    style={{ opacity: 0.7 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="card-header">
                <div>
                  <div className="card-title">Security Verification</div>
                  <div className="card-subtitle">Confirm your identity to finalise submission</div>
                </div>
                <ShieldCheck size={22} color="var(--danger)" />
              </div>

              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(220,38,38,0.2)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: '0.82rem',
                  color: 'var(--danger)',
                }}
              >
                ⚠️ For security purposes, we require your portal credentials to verify your identity.
              </div>

              <div className="form-group">
                <label className="form-label">Current Portal Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    value={form.current_password}
                    onChange={handleChange('current_password')}
                    onFocus={handleFocus('current_password')}
                    required
                    placeholder="Enter your current password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password (if changing)</label>
                <input
                  className="form-input"
                  type="password"
                  value={form.new_password}
                  onChange={handleChange('new_password')}
                  onFocus={handleFocus('new_password')}
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={loading || !form.current_password}
                >
                  {loading ? 'Submitting…' : 'Submit Declaration'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default Task;
