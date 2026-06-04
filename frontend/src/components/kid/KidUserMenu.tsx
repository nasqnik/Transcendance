import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import Button from '../Button'
import FormField from '../FormField'
import FormAlert from '../FormAlert'
import { inviteParent } from '../../api/auth'
import { getApiErrorKey } from '../../api/errors'
import { useFormErrors } from '../../hooks/useFormErrors'
import { isValidEmail, isEmpty } from '../../utils/validation'

export default function KidUserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()

  // ── Menu open/close ────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) closeMenu()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // ── Invite parent ──────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen]         = useState(false)
  const [inviteEmail, setInviteEmail]       = useState('')
  const [usernameHint, setUsernameHint]     = useState('')
  const [inviteErrorKey, setInviteErrorKey] = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo]       = useState<string | null>(null)

  function closeMenu() {
    setMenuOpen(false)
    setInviteOpen(false)
    setSentTo(null)
    setInviteEmail('')
    setUsernameHint('')
    setInviteErrorKey(null)
    resetFieldErrors()
  }

  async function handleInvite(e: React.SubmitEvent) {
    e.preventDefault()
    setInviteErrorKey(null)

    const errs: Record<string, string> = {}
    if (isEmpty(inviteEmail))            errs.email = t('errors.required')
    else if (!isValidEmail(inviteEmail)) errs.email = t('errors.invalidEmail')
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    resetFieldErrors()
    setIsLoading(true)

    try {
      await inviteParent(inviteEmail, usernameHint || undefined)
      setSentTo(inviteEmail)
      setInviteEmail('')
      setUsernameHint('')
    } catch (err) {
      setInviteErrorKey(getApiErrorKey(err))
    } finally {
      setIsLoading(false)
    }
  }

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
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-200 z-50 overflow-hidden">

          {sentTo ? (
            /* ── Success ── */
            <div className="p-4 flex flex-col items-center gap-3">
              <div className="text-3xl" aria-hidden="true">📬</div>
              <p className="font-body text-sm font-semibold text-primary-700 text-center">
                {t('inviteParent.success', { email: sentTo })}
              </p>
              <p className="font-body text-xs text-gray-500 text-center">
                {t('inviteParent.successHint')}
              </p>
              <Button variant="secondary" onClick={() => setSentTo(null)}>
                {t('inviteParent.sendAnother')}
              </Button>
            </div>

          ) : inviteOpen ? (
            /* ── Invite form ── */
            <div className="p-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="flex items-center gap-1 font-body text-sm text-gray-500 hover:text-gray-700 focus-ring rounded self-start"
              >
                ← {t('auth.back')}
              </button>
              <p className="font-heading font-bold text-gray-900">{t('inviteParent.title')}</p>
              <form
                noValidate
                onSubmit={handleInvite}
                className="flex flex-col gap-3"
                aria-label={t('inviteParent.title')}
                aria-busy={isLoading}
              >
                {inviteErrorKey && <FormAlert message={t(inviteErrorKey)} />}
                <FormField
                  id="invite-email"
                  label={t('inviteParent.email')}
                  type="email"
                  value={inviteEmail}
                  required
                  autoComplete="off"
                  disabled={isLoading}
                  error={fieldErrors.email}
                  onChange={e => { setInviteEmail(e.target.value); clearFieldError('email') }}
                />
                <FormField
                  id="invite-username-hint"
                  label={t('inviteParent.usernameHint')}
                  type="text"
                  dir="ltr"
                  value={usernameHint}
                  autoComplete="off"
                  disabled={isLoading}
                  onChange={e => setUsernameHint(e.target.value)}
                />
                <Button variant="primary" type="submit" disabled={isLoading}>
                  {isLoading ? t('inviteParent.sending') : t('inviteParent.submit')}
                </Button>
              </form>
            </div>

          ) : (
            /* ── Main menu ── */
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-body font-semibold text-sm text-gray-900">{currentUser?.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="w-full px-4 py-3 flex items-center gap-3 font-body text-sm text-gray-700 hover:bg-gray-50 focus-ring transition-colors text-left"
              >
                <span aria-hidden="true">👥</span>
                {t('inviteParent.title')}
              </button>
              <div className="border-t border-gray-100" />
              <button
                type="button"
                onClick={() => { logout(); navigate('/') }}
                className="w-full px-4 py-3 flex items-center gap-3 font-body text-sm text-danger-500 hover:bg-danger-50 focus-ring transition-colors text-left"
              >
                <span aria-hidden="true">🚪</span>
                {t('nav.logout')}
              </button>
            </>
          )}

        </div>
      )}
    </div>
  )
}
