import client from './client'

export const adminApi = {
  // SENTINEL-AUDIT-FIX: use the dedicated admin login endpoint that validates PIN + admin role
  login: (email: string, password: string, pin: string) =>
    client.post('/auth/admin/login', { email, password, pin }),

  getOverview: () => client.get('/admin/sim/stats/overview'),

  getEmployees: (params?: Record<string, unknown>) =>
    client.get('/admin/sim/employees', { params }),

  getEmployee: (hash: string) => client.get(`/admin/sim/employees/${hash}`),

  triggerSingle: (data: unknown) => client.post('/admin/sim/campaigns/single', data),

  triggerRandom: () => client.post('/admin/sim/campaigns/random'),

  triggerBulk: (data: unknown) => client.post('/admin/sim/campaigns/bulk', data),

  getCampaigns: (params?: Record<string, unknown>) =>
    client.get('/admin/sim/campaigns', { params }),

  getCampaign: (id: string) => client.get(`/admin/sim/campaigns/${id}`),

  cancelCampaign: (id: string) => client.post(`/admin/sim/campaigns/${id}/cancel`),

  getThreats: (status = 'all') =>
    client.get('/admin/sim/threats', { params: { status } }),

  approveThreat: (id: string) => client.post(`/admin/sim/threats/${id}/approve`),

  rejectThreat: (id: string) => client.post(`/admin/sim/threats/${id}/reject`),

  runScraper: () => client.post('/admin/sim/scraper/run'),

  getLeaderboard: () => client.get('/admin/sim/reports/leaderboard'),

  getFlagged: () => client.get('/admin/sim/reports/flagged'),

  getPosture: () => client.get('/admin/sim/reports/posture'),
}
