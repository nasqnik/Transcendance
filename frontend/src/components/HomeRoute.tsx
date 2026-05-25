import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { dashboardPathForRole } from '../auth/session'
import AuthHydrationFallback from './AuthHydrationFallback'
import { useAuthHydrated } from '../hooks/useAuthHydrated'
import Landing from '../pages/Landing'

/** `/` — landing for guests; send logged-in users to the right dashboard. */
export default function HomeRoute() {
  const hydrated = useAuthHydrated()
  const { isAuthenticated, currentUser } = useAuthStore()

  if (!hydrated) {
    return <AuthHydrationFallback />
  }

  if (isAuthenticated) {
    return <Navigate to={dashboardPathForRole(currentUser?.role)} replace />
  }

  return <Landing />
}
