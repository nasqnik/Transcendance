import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import Button from '../components/Button'

export default function ChildDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6">
      <h1 className="font-heading text-3xl font-bold text-primary-700">
        {t('dashboard.greeting', { name: currentUser?.username })}
      </h1>
      <p className="font-body text-sm text-gray-500">Kid dashboard — coming soon</p>
      <Button variant="secondary" onClick={handleLogout}>
        {t('nav.logout')}
      </Button>
    </main>
  )
}
