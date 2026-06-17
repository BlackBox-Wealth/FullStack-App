import axios from 'axios';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './store';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

const API_BASE = '/api/v1'; 
const COMPLIANCE_API_BASE = '/compliance-api/api/v1'; 

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const complianceApi = axios.create({
  baseURL: COMPLIANCE_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Handle 401 — attempt token refresh via cookie, then redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestUrl = String(originalRequest?.url || '');
    const skipAuthRefresh = Boolean(originalRequest?._skipAuthRefresh);
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/me') ||
      requestUrl.includes('/auth/behavior-anomaly');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !skipAuthRefresh &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;
      try {
        // Refresh token is in httpOnly cookie, sent automatically
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        // Retry original request — new access_token cookie is set
        return api(originalRequest);
      } catch {
        // Refresh failed — clear stale auth state and redirect once
        useAuthStore.getState().logout();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────
export const authAPI = {
  login: (email: string, password: string, captchaToken?: string) =>
    api.post('/auth/login', { email, password, captcha_token: captchaToken }),
  register: (data: { email: string; password: string; full_name: string; phone: string; captcha_token?: string }) =>
    api.post('/auth/register', data),
  me: (config?: AxiosRequestConfig) => api.get('/auth/me', config),
  logout: () => api.post('/auth/logout'),
  sendOTP: () => api.post('/auth/send-otp'),
  verifyOTP: (otp: string) => api.post(`/auth/verify-otp?otp=${otp}`),
  sendPhoneOtp: (phone: string) =>
    api.post('/auth/send-phone-otp', { phone }),
  verifyPhoneOtp: (phone: string, otp: string) =>
    api.post('/auth/verify-phone', { phone, otp }),
  sendEmailOtpForRegistration: (email: string) =>
    api.post('/auth/register/send-email-otp', null, { params: { email } }),
  verifyEmailOtpForRegistration: (email: string, otp: string) =>
    api.post('/auth/register/verify-email-otp', null, { params: { email, otp } }),
  sendPhoneOtpForRegistration: (phone: string) =>
    api.post('/auth/register/send-phone-otp', null, { params: { phone } }),
  completeRegistration: (data: { 
    email: string; 
    password: string; 
    full_name: string; 
    phone: string; 
    email_otp: string; 
    phone_otp: string;
    captcha_token?: string;
  }) => api.post('/auth/register/complete', data),
  updateRecoveryInfo: (data: { recovery_email?: string; recovery_phone?: string }) =>
    api.put('/auth/recovery-info', data),
  sendRecoveryOtp: (data: { recovery_email?: string; recovery_phone?: string }) =>
    api.post('/auth/recovery-info/send-otp', data),
  verifyAndUpdateRecoveryInfo: (params: { 
    recovery_email?: string; 
    recovery_phone?: string; 
    email_otp?: string; 
    phone_otp?: string 
  }) => api.post('/auth/recovery-info/verify-and-update', null, { params }),
  requestPasswordReset: (email: string) =>
    api.post('/auth/request-password-reset', { email }),
  resetPassword: (data: { email: string; otp: string; new_password: string }) =>
    api.post('/auth/reset-password', data),
  updateProfile: (data: { language?: string; avatar_url?: string; is_new_user?: boolean; theme_mode?: string; accessibility?: any }) =>
    api.put('/auth/profile', data),
};

// ─── Accounts ────────────────────────
export const accountsAPI = {
  getAll: () => api.get('/accounts/'),
  get: (id: string) => api.get(`/accounts/${id}`),
  create: (data: { account_type: string; bank_name: string; initial_deposit: number }) =>
    api.post('/accounts/', data),
  linkExternal: (data: { bank_name: string; account_number: string; ifsc_code: string; account_holder_name: string, balance: number }) =>
    api.post('/accounts/link-external', data),
  freeze: (id: string) => api.put(`/accounts/${id}/freeze`),
  unfreeze: (id: string) => api.put(`/accounts/${id}/unfreeze`),
  delete: (id: string) => api.delete(`/accounts/${id}`),
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
  initiate: (data: { from_account_id: string; to_account_number?: string; to_vpa?: string; amount: number; description: string; otp_channel?: string }) =>
    api.post('/payments/initiate', data),
  verify: (paymentId: string, otp: string) =>
    api.post('/payments/verify', { payment_id: paymentId, otp }),
  resendOTP: (paymentId: string, otpChannel: string) =>
    api.post(`/payments/${paymentId}/resend?otp_channel=${otpChannel}`),
  getAll: () => api.get('/payments/'),
  generateQR: (amount: number, description?: string) =>
    api.get('/payments/qr/generate', { params: { amount, description } }),
};

// ─── Investments ────────────────────────
export const investmentsAPI = {
  getAll: () => api.get('/investments/'),
  create: (data: { investment_type: string; symbol: string; amount: number; quantity: number }) =>
    api.post('/investments/', data),
  delete: (id: string) => api.delete(`/investments/${id}`),
  portfolio: () => api.get('/investments/portfolio'),
  stocks: () => api.get('/investments/stocks'),
  getGoals: () => api.get('/investments/goals'),
  createGoal: (data: { name: string; target_amount: number; current_amount: number; deadline: string }) =>
    api.post('/investments/goals', data),
  deleteGoal: (id: string) => api.delete(`/investments/goals/${id}`),
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
  firstTimeTips: () => api.get('/investments/first-time-tips'),
  markInvested: () => api.post('/investments/mark-invested'),
  news: () => api.get('/investments/news'),
  smartGoalInsights: () => api.get('/investments/goals/smart-insights'),
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
  accountInsights: () => api.get('/ml/account-insights'),
  sipInsights: () => api.get('/ml/sip-insights'),
  assetInsights: () => api.get('/ml/asset-insights'),
  loanInsights: () => api.get('/ml/loan-insights'),
  whatifScenario: (scenarioType: string, customQuery?: string) => api.post('/ml/whatif-scenario', { scenario_type: scenarioType, custom_query: customQuery }),
  chatbot: (message: string) => api.post('/ml/chatbot', { message }),
  classifyTransaction: (text: string) => api.post('/ml/classify-transaction', { text }),
  behavioralAnomaly: (behaviorData: Record<string, number>, email?: string, options?: { skipAuthRefresh?: boolean }) =>
    api.post(
      '/ml/behavior-anomaly',
      { behavior_data: behaviorData, email },
      options?.skipAuthRefresh ? ({ _skipAuthRefresh: true } as AxiosRequestConfig) : undefined
    ),
  voiceAgent: (message: string) => api.post('/ml/voice-agent', { message }),
  forecastCashflow: (days: number = 30) => api.post('/ml/forecast-cashflow', { days }),
};

// ─── Compliance AI ──────────────────
export const complianceAPI = {
  query: (text: string) => complianceApi.post('/compliance/query', { text }),
};

// ─── KYC ────────────────────────
export const kycAPI = {
  upload: (aadhaarFront: string, aadhaarBack: string, pan: string, aadhaarNumber?: string, panNumber?: string) =>
    api.post('/kyc/upload', { aadhaar_front: aadhaarFront, aadhaar_back: aadhaarBack, pan, aadhaar_number: aadhaarNumber, pan_number: panNumber }),
  getStatus: () => api.get('/kyc/status'),
};

// ─── Admin ────────────────────────
export const adminAPI = {
  getUsers: (params?: { role?: string }) => api.get('/admin/users', { params }),
  updateRole: (userId: string, role: string) => api.put(`/admin/users/${userId}/role?role=${role}`),
  deactivateUser: (userId: string) => api.put(`/admin/users/${userId}/deactivate`),
  activateUser: (userId: string) => api.put(`/admin/users/${userId}/activate`),
  getPendingKYC: () => api.get('/admin/kyc/pending'),
  getEscalatedKYC: () => api.get('/admin/kyc/escalated'),
  kycAction: (userId: string, action: string, comments?: string) => 
    api.put(`/admin/kyc/${userId}/action`, { action, comments }),
  getAllLoans: (status?: string) => api.get('/admin/loans', { params: { status } }),
  approveLoan: (loanId: string) => api.put(`/admin/loans/${loanId}/approve`),
  rejectLoan: (loanId: string) => api.put(`/admin/loans/${loanId}/reject`),
  getFraudAlerts: () => api.get('/admin/fraud-alerts'),
  resolveFraudAlert: (alertId: string, resolution: string) =>
    api.put(`/admin/fraud-alerts/${alertId}/resolve?resolution=${resolution}`),
  getAuditLogs: () => api.get('/admin/audit-logs'),
  getAnalytics: () => api.get('/admin/analytics'),
  getInsiderThreats: () => api.get('/admin/insider-threat-check'),
  getNotificationSummary: () => api.get('/employee/notifications/summary'),
  getRiskSummary: () => api.get('/risk/summary'),
  getPerformance: (params?: { limit?: number; offset?: number }) => api.get('/admin/performance', { params }),
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

// ─── Sessions ────────────────────────
export const sessionsAPI = {
  getActiveSessions: () => api.get('/sessions'),
  revokeSession: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
  revokeAllSessions: () => api.delete('/sessions'),
};

// ─── Account Aggregator ────────────────────────
export const aaAPI = {
  requestConsent: () => api.post('/aa/consent/request'),
  getConsentStatus: (consentId: string) => api.get(`/aa/consent/${consentId}`),
  getAccounts: () => api.get('/aa/accounts'),
  getTransactions: (accountId: string) => api.get(`/aa/transactions/${accountId}`),
};

// ─── Assets ────────────────────────
export const assetsAPI = {
  getAll: () => api.get('/assets/'),
  create: (data: { name: string; asset_type: string; purchase_price: number; current_valuation: number; purchase_date?: string; description?: string }) =>
    api.post('/assets/', data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  getNetWorthSummary: () => api.get('/assets/net-worth-summary'),
};

// ─── Budgets ────────────────────────
export const budgetsAPI = {
  getAll: () => api.get('/budgets/'),
  create: (data: { category: string; amount_limit: number; period?: string }) =>
    api.post('/budgets/', data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

// ─── Family ────────────────────────
export const familyAPI = {
  invite: (inviteeEmail: string) => api.post('/family/invite', { invitee_email: inviteeEmail }),
  respond: (invitationId: string, action: 'accept' | 'reject') => 
    api.post('/family/respond', { invitation_id: invitationId, action }),
  setLimit: (memberUserId: string, spendingLimit: number) => 
    api.post('/family/set-limit', { member_user_id: memberUserId, spending_limit: spendingLimit }),
  getMyFamily: () => api.get('/family/my-family'),
  getPendingInvitations: () => api.get('/family/invitations'),
  removeMember: (memberUserId: string) => api.delete(`/family/member/${memberUserId}`),
};

// ─── Credit ────────────────────────
export const creditAPI = {
  getScore: () => api.get('/credit/score'),
};

// ─── AI Agents ────────────────────────
export const agentsAPI = {
  getAdvisorAdvice: (payload: { user_query: string }) =>
    api.post('/agents/advisor', payload),
  getDailyLessons: (payload: object) =>
    api.post('/agents/teacher', payload),
};

export default api;
