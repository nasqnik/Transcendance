import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import KidUserMenu from './KidUserMenu'

export default function KidTopbar() {
  const { t } = useTranslation()
  const { currentUser } = useAuthStore()

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 id="dashboard-heading" className="font-heading text-3xl font-bold text-gray-900">
          {t('dashboard.greeting', { name: currentUser?.username })} 👋
        </h1>
        <p className="font-body text-sm text-gray-400">{t('kidDash.readyToLevel')}</p>
      </div>

      <KidUserMenu />
    </header>
  )
}
