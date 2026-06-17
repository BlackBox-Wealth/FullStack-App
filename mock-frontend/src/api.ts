import axios from 'axios';
import { usePhishingStore } from './store';

const portalApi = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use((config) => {
  const jwt = usePhishingStore.getState().jwt;
  if (jwt) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${jwt}`;
  }
  return config;
});

export async function fetchPortalSession(token: string) {
  const res = await portalApi.get(`/api/sim/phishing/portal-session/${token}`);
  return res.data as {
    jwt: string;
    user: import('./store').PhishingUser;
    context: import('./store').PhishingContext;
  };
}

export async function fetchInbox() {
  const res = await portalApi.get('/api/v1/portal/inbox');
  // Return the raw response payload (may be { success, data } or { emails })
  return res.data;
}

export async function fetchEmailDetail(emailId: string) {
  const res = await portalApi.get(`/api/v1/portal/inbox/${emailId}`);
  return res.data as FakeEmail;
}

export async function reportEmail(emailId: string) {
  const res = await portalApi.post(`/api/v1/portal/inbox/${emailId}/report`);
  return res.data;
}

export interface FakeEmail {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  preview: string;
  body_html: string;
  timestamp: string;
  is_phishing: boolean;
  is_read: boolean;
  category: string;
  avatar_color: string;
}

export default portalApi;
