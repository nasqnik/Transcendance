import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import useAuthStore from '../store/authStore'
import Button from '../components/Button'
import FormField from '../components/FormField'
import FormAlert from '../components/FormAlert'
import { inviteParent } from '../api/auth'
import { parseApiError } from '../api/errors'
import { useFormErrors } from '../hooks/useFormErrors'
import { usePageTitle } from '../hooks/usePageTitle'
import { isValidEmail, isEmpty } from '../utils/validation'

export default function ChildDashboard() {
  const { t } = useTranslation()
  usePageTitle(t('app.name'))
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()

  const [email, setEmail] = useState('')
  const [usernameHint, setUsernameHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  function handleLogout() {
    logout()
    navigate('/')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errs: Record<string, string> = {}
    if (isEmpty(email)) errs.email = t('errors.required')
    else if (!isValidEmail(email)) errs.email = t('errors.invalidEmail')
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    resetFieldErrors()
    setIsLoading(true)

    try {
      await inviteParent(email, usernameHint || undefined)
      setSentTo(email)
      setEmail('')
      setUsernameHint('')
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main
      aria-labelledby="dashboard-heading"
      className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12"
    >
      <h1 id="dashboard-heading" className="font-heading text-3xl font-bold text-primary-700">
        {t('dashboard.greeting', { name: currentUser?.username })}
      </h1>
      <p className="font-body text-sm text-gray-500">Kid dashboard — coming soon</p>

      {/* ── Invite second parent ─────────────────────────────────────── */}
      <section
        aria-labelledby="invite-parent-heading"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col items-center gap-4 w-80 max-w-full bg-white rounded-2xl p-6 shadow-sm"
      >
        <h2 id="invite-parent-heading" className="font-heading text-xl font-bold text-primary-700 text-center">
          {t('inviteParent.title')}
        </h2>
        <p className="font-body text-sm text-gray-500 text-center">
          {t('inviteParent.hint')}
        </p>

        {sentTo ? (
          // Success state
          <>
            <div className="text-4xl" aria-hidden="true">📬</div>
            <p className="font-body text-sm font-semibold text-primary-700 text-center">
              {t('inviteParent.success', { email: sentTo })}
            </p>
            <p className="font-body text-sm text-gray-500 text-center">
              {t('inviteParent.successHint')}
            </p>
            <Button variant="secondary" onClick={() => setSentTo(null)}>
              {t('inviteParent.sendAnother')}
            </Button>
          </>
        ) : (
          // Form state
          <form
            noValidate
            onSubmit={handleInvite}
            className="flex flex-col gap-4 w-full"
            aria-labelledby="invite-parent-heading"
            aria-busy={isLoading}
          >
            {error && <FormAlert message={error} />}

            <FormField
              id="invite-email"
              label={t('inviteParent.email')}
              type="email"
              value={email}
              required
              autoComplete="off"
              error={fieldErrors.email}
              onChange={e => {
                setEmail(e.target.value)
                clearFieldError('email')
              }}
            />

            <FormField
              id="invite-username-hint"
              label={t('inviteParent.usernameHint')}
              type="text"
              dir="ltr"
              value={usernameHint}
              autoComplete="off"
              onChange={e => setUsernameHint(e.target.value)}
            />

            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? t('inviteParent.sending') : t('inviteParent.submit')}
            </Button>
          </form>
        )}
      </section>

      <Button variant="secondary" onClick={handleLogout}>
        {t('nav.logout')}
      </Button>
    </main>
  )
}
