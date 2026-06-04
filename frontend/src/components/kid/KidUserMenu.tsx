import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'

export default function KidUserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="relative" ref={menuRef}>

      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setMenuOpen(v => !v)}
        aria-label={currentUser?.username ?? 'Menu'}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-heading font-bold text-primary-700 hover:bg-primary-200 focus-ring transition-colors"
      >
        {currentUser?.username?.[0]?.toUpperCase() ?? '?'}
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-body font-semibold text-sm text-gray-900">{currentUser?.username}</p>
          </div>
          <button
            type="button"
            onClick={() => { logout(); navigate('/') }}
            className="w-full px-4 py-3 flex items-center gap-3 font-body text-sm text-danger-500 hover:bg-danger-50 focus-ring transition-colors text-left"
          >
            <span aria-hidden="true">🚪</span>
            {t('nav.logout')}
          </button>
        </div>
      )}

    </div>
  )
}
