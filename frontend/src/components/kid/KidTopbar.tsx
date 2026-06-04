import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import { useKidLevel } from '../../hooks/useKidLevel'
import KidUserMenu from './KidUserMenu'

export default function KidTopbar() {
  const { t } = useTranslation()
  const { currentUser } = useAuthStore()
  const { level, progress, streak } = useKidLevel()

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 id="dashboard-heading" className="font-heading text-3xl font-bold text-gray-900">
          {t('dashboard.greeting', { name: currentUser?.username })} 👋
        </h1>
        <p className="font-body text-sm text-gray-400">{t('kidDash.readyToLevel')}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Streak */}
        {streak > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-heading font-bold text-lg leading-none">🔥 {streak}</span>
            <span className="font-body text-xs text-gray-400">{t('kidDash.streak')}</span>
          </div>
        )}

        {/* Overall level badge */}
        <div className="flex flex-col items-end gap-1">
          <span className="font-body font-bold text-sm text-gray-700">
            ⭐ {t('kidDash.level', { level })}
          </span>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <KidUserMenu />
      </div>
    </header>
  )
}
