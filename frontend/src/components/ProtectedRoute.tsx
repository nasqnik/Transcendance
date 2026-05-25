import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { dashboardPathForRole } from '../auth/session'
import AuthHydrationFallback from './AuthHydrationFallback'
import { useAuthHydrated } from '../hooks/useAuthHydrated'

interface ProtectedRouteProps {
  role?: 'parent' | 'kid'
}

export default function ProtectedRoute({ role }: ProtectedRouteProps) {
  const hydrated = useAuthHydrated()
  const { isAuthenticated, currentUser } = useAuthStore()

  if (!hydrated) {
    return <AuthHydrationFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role && currentUser?.role !== role) {
    return <Navigate to={dashboardPathForRole(currentUser?.role)} replace />
  }

  return <Outlet />
}
