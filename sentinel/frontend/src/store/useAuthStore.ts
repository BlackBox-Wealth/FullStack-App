import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  role: string
  department?: string
  employee_id?: string
}

export type AuthStatus = 'checking' | 'authorized' | 'unauthorized' | 'forbidden'

interface AuthState {
  user: User | null
  authStatus: AuthStatus
  setUser: (user: User) => void
  clearAuth: () => void
  setAuthStatus: (status: AuthStatus) => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  authStatus: 'checking',
  setUser: (user) => set({ user, authStatus: 'authorized' }),
  clearAuth: () => set({ user: null, authStatus: 'unauthorized' }),
  setAuthStatus: (status) => set({ authStatus: status }),
  isAdmin: () => {
    const role = get().user?.role
    return role === 'superadmin' || role === 'super_admin'
  },
}))
