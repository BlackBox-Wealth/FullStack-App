import axios from 'axios';

const API_BASE = '/api/v1';  // Relative - works on any origin

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Handle 401 — attempt token refresh via cookie, then redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Refresh token is in httpOnly cookie, sent automatically
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        // Retry original request — new access_token cookie is set
        return api(originalRequest);
      } catch {
        // Refresh failed — clear local state and redirect
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; phone: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  sendOTP: () => api.post('/auth/send-otp'),
  verifyOTP: (otp: string) => api.post(`/auth/verify-otp?otp=${otp}`),
  sendPhoneOtp: (phone: string) =>
  api.post('/auth/send-phone-otp', { phone }),
verifyPhoneOtp: (phone: string, otp: string) =>
  api.post('/auth/verify-phone', { phone, otp }),
  sendEmailOtpForRegistration: (email: string) =>
    api.post('/auth/register/send-email-otp', null, { params: { email } }),
  sendPhoneOtpForRegistration: (phone: string) =>
    api.post('/auth/register/send-phone-otp', null, { params: { phone } }),
  completeRegistration: (data: { 
    email: string; 
    password: string; 
    full_name: string; 
    phone: string; 
    email_otp: string; 
    phone_otp: string; 
  }) => api.post('/auth/register/complete', data),
};

// ─── Accounts ────────────────────────
export const accountsAPI = {
  getAll: () => api.get('/accounts/'),
  get: (id: string) => api.get(`/accounts/${id}`),
  create: (data: { account_type: string; bank_name: string; initial_deposit: number }) =>
    api.post('/accounts/', data),
  linkExternal: (data: { bank_name: string; account_number: string; ifsc_code: string; account_holder_name: string }) =>
    api.post('/accounts/link-external', data),
  freeze: (id: string) => api.put(`/accounts/${id}/freeze`),
  unfreeze: (id: string) => api.put(`/accounts/${id}/unfreeze`),
};

// ─── Transactions ────────────────────────
export const transactionsAPI = {
  getAll: (params?: { account_id?: string; category?: string; limit?: number }) =>
    api.get('/transactions/', { params }),
  get: (id: string) => api.get(`/transactions/${id}`),
  create: (data: { account_id: string; amount: number; transaction_type: string; category: string; description: string }) =>
    api.post('/transactions/', data),
  spendingAnalysis: (months?: number) =>
    api.get('/transactions/spending-analysis', { params: { months } }),
};

// ─── Payments ────────────────────────
export const paymentsAPI = {
  initiate: (data: { from_account_id: string; to_account_number: string; amount: number; description: string }) =>
    api.post('/payments/initiate', data),
  verify: (paymentId: string, otp: string) =>
    api.post('/payments/verify', { payment_id: paymentId, otp }),
  getAll: () => api.get('/payments/'),
};

// ─── Investments ────────────────────────
export const investmentsAPI = {
  getAll: () => api.get('/investments/'),
  create: (data: { investment_type: string; symbol: string; amount: number; quantity: number }) =>
    api.post('/investments/', data),
  portfolio: () => api.get('/investments/portfolio'),
  stocks: () => api.get('/investments/stocks'),
  getGoals: () => api.get('/investments/goals'),
  createGoal: (data: { name: string; target_amount: number; current_amount: number; deadline: string }) =>
    api.post('/investments/goals', data),
  getSIPs: () => api.get('/investments/sips'),
  createSIP: (data: { 
    name: string; 
    fund_name: string; 
    fund_category: string; 
    amount: number; 
    frequency: string; 
    start_date: string; 
    account_id: string; 
    step_up_pct?: number; 
    goal_id?: string 
  }) => api.post('/investments/sips', data),
  updateSIP: (id: string, data: { amount?: number; frequency?: string; status?: string; step_up_pct?: number }) =>
    api.patch(`/investments/sips/${id}`, data),
};

// ─── Loans ────────────────────────
export const loansAPI = {
  apply: (data: { loan_type: string; amount: number; tenure_months: number; purpose: string }) =>
    api.post('/loans/apply', data),
  getAll: () => api.get('/loans/'),
};

// ─── ML / AI ────────────────────────
export const mlAPI = {
  recommendations: () => api.get('/ml/recommendations'),
  fraudCheck: (data: object) => api.post('/ml/fraud-check', data),
  spendingInsights: () => api.get('/ml/spending-insights'),
  chatbot: (message: string) => api.post('/ml/chatbot', { message }),
};

// ─── Admin ────────────────────────
export const adminAPI = {
  getUsers: (params?: { role?: string }) => api.get('/admin/users', { params }),
  updateRole: (userId: string, role: string) => api.put(`/admin/users/${userId}/role?role=${role}`),
  deactivateUser: (userId: string) => api.put(`/admin/users/${userId}/deactivate`),
  activateUser: (userId: string) => api.put(`/admin/users/${userId}/activate`),
  getPendingKYC: () => api.get('/admin/kyc/pending'),
  verifyKYC: (userId: string, status: string) => api.put(`/admin/kyc/${userId}/verify?status=${status}`),
  getAllLoans: (status?: string) => api.get('/admin/loans', { params: { status } }),
  approveLoan: (loanId: string) => api.put(`/admin/loans/${loanId}/approve`),
  rejectLoan: (loanId: string) => api.put(`/admin/loans/${loanId}/reject`),
  getFraudAlerts: () => api.get('/admin/fraud-alerts'),
  resolveFraudAlert: (alertId: string, resolution: string) =>
    api.put(`/admin/fraud-alerts/${alertId}/resolve?resolution=${resolution}`),
  getAuditLogs: () => api.get('/admin/audit-logs'),
  getAnalytics: () => api.get('/admin/analytics'),
};

// ─── Notifications ────────────────────────
export const notificationsAPI = {
  getAll: () => api.get('/notifications/'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getAlerts: (isRead?: boolean) => api.get('/notifications/alerts', { params: { is_read: isRead } }),
  markAlertRead: (id: string) => api.put(`/notifications/alerts/${id}/read`),
  getUnreadAlertsCount: () => api.get('/notifications/alerts/unread-count'),
};

// ─── Security ────────────────────────
export const securityAPI = {
  reportUnauthorizedLogin: () => api.post('/auth/security/report'),
  getKnownDevices: () => api.get('/auth/devices'),
};

export default api;
