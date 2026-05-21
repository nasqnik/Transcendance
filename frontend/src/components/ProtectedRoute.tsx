import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  role?: 'parent' | 'kid'
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { isAuthenticated, currentUser } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role && currentUser?.role !== role) {
    return <Navigate to={currentUser?.role === 'parent' ? '/parent/dashboard' : '/dashboard'} replace />
  }

  return <>{children}</>
}
