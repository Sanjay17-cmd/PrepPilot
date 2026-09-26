import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { LoadingPage } from '../ui/Loading'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { appUser, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingPage />

  if (!appUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && appUser.profile?.user_type !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  // If onboarding is incomplete and they're not already in onboarding, redirect there
  if (
    appUser.profile &&
    !appUser.profile.onboarding_completed &&
    !location.pathname.startsWith('/onboarding')
  ) {
    return <Navigate to="/onboarding/education" replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth()

  if (loading) return <LoadingPage />

  if (appUser) {
    if (!appUser.profile?.onboarding_completed) {
      return <Navigate to="/onboarding/education" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
