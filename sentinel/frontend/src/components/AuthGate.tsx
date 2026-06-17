import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Shield, Lock, AlertTriangle } from 'lucide-react'
import { useAuthStore, type AuthStatus } from '../store/useAuthStore'
import client from '../api/client'

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-bg-base">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-primary/15 flex items-center justify-center">
          <Shield size={28} className="text-accent-primary animate-pulse" />
        </div>
        <p className="text-sm text-text-muted tracking-wide">Verifying access...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ status }: { status: Extract<AuthStatus, 'unauthorized' | 'forbidden'> }) {
  const isUnauthorized = status === 'unauthorized'

  return (
    <div className="flex items-center justify-center h-screen bg-bg-base bg-composite">
      <div className="card max-w-sm w-full mx-4 p-8 flex flex-col items-center text-center gap-5">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            isUnauthorized ? 'bg-warning/10' : 'bg-danger/10'
          }`}
        >
          {isUnauthorized
            ? <Lock size={30} className="text-warning" />
            : <AlertTriangle size={30} className="text-danger" />
          }
        </div>

        <div className="space-y-1.5">
          <h2 className="font-heading font-semibold text-lg text-text-primary">
            {isUnauthorized ? 'Authentication Required' : 'Access Denied'}
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            {isUnauthorized
              ? 'Your session has expired or you are not logged in. Please access this panel through the authorised PSB portal.'
              : 'This control panel requires administrator privileges. Contact your system administrator if you believe this is an error.'
            }
          </p>
        </div>

        <div className="w-full pt-3 border-t border-border flex items-center justify-center gap-2 text-xs text-text-muted">
          <Shield size={11} />
          <span>PSB Sentinel · Security Operations</span>
        </div>
      </div>
    </div>
  )
}

export default function AuthGate() {
  const { authStatus, setUser, setAuthStatus } = useAuthStore()

  useEffect(() => {
    client
      .get('/auth/me')
      .then((res) => {
        const data = res.data
        const role: string = data.role ?? ''
        if (role !== 'superadmin' && role !== 'super_admin') {
          setAuthStatus('forbidden')
        } else {
          setUser({
            id: data.id,
            name: data.full_name ?? data.name ?? data.email,
            email: data.email,
            role,
          })
        }
      })
      .catch(() => {
        setAuthStatus('unauthorized')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authStatus === 'checking') return <LoadingScreen />
  if (authStatus === 'unauthorized' || authStatus === 'forbidden') {
    return <ErrorScreen status={authStatus} />
  }
  return <Outlet />
}
