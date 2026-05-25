import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { dashboardPathForRole } from '../auth/session'
import AuthHydrationFallback from './AuthHydrationFallback'
import { useAuthHydrated } from '../hooks/useAuthHydrated'

/** Public auth pages — redirect to dashboard if already logged in. */
export default function GuestRoute() {
  const hydrated = useAuthHydrated()
  const { isAuthenticated, currentUser } = useAuthStore()

  if (!hydrated) {
    return <AuthHydrationFallback />
  }

  if (isAuthenticated) {
    return <Navigate to={dashboardPathForRole(currentUser?.role)} replace />
  }

  return <Outlet />
}
