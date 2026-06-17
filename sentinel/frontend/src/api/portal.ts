import client from './client'

export const portalApi = {
  login: (email: string, password: string) =>
    client.post('/auth/login', { email, password }),

  getDashboard: () => client.get('/portal/dashboard'),

  getInbox: () => client.get('/portal/inbox'),

  getEmail: (emailId: string) => client.get(`/portal/inbox/${emailId}`),

  reportEmail: (emailId: string) => client.post(`/portal/inbox/${emailId}/report`),

  getScenario: (token: string) =>
    client.get(`/api/sim/social/${token}`, { baseURL: '/' }),

  respondToScenario: (token: string, optionIndex: number) =>
    client.post(`/api/sim/social/respond/${token}`, { option_index: optionIndex }, { baseURL: '/' }),

  getIncidentForm: (token: string) =>
    client.get(`/api/sim/incident/form/${token}`, { baseURL: '/' }),

  submitIncident: (token: string, data: Record<string, string>) =>
    client.post(`/api/sim/incident/submit/${token}`, data, { baseURL: '/' }),
}
