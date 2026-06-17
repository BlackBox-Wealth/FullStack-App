import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true
      try {
        await client.post('/auth/refresh')
        return client(original)
      } catch {
        // refresh failed — fall through to clearAuth below
      }
    }
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth()
    }
    if (err.response?.status === 403) {
      useAuthStore.getState().setAuthStatus('forbidden')
    }
    return Promise.reject(err)
  }
)

export default client
