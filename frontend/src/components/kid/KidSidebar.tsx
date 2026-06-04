import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '🏠', labelKey: 'kidDash.nav.home',     path: '/dashboard' },
  { icon: '⚙️', labelKey: 'kidDash.nav.settings', path: '/settings'  },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function KidSidebar() {
  const { t } = useTranslation()

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">

      {/* Logo */}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">⭐</span>
          <div>
            <div className="font-heading font-bold text-primary-700 text-lg leading-tight">
              {t('app.name')}
            </div>
            <div className="font-body text-xs text-gray-400">
              {t('app.tagline')}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label={t('a11y.mainNav')} className="flex-1 px-3 py-2 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-body font-semibold text-sm transition-colors focus-ring ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
