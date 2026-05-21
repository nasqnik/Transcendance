import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import useAuthStore from '../store/authStore'
import { registerParent, loginParent, loginWithGoogle, signupKid, decodeJWT, parseApiError, type KidSignupResponse } from '../api/auth'
import { isEmpty, isValidEmail } from '../utils/validation'

export default function Signup() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [role, setRole] = useState<'parent' | 'kid' | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  // After kid signup: show the "waiting for parent" screen
  // We store the kid's info so we can show their parent_email in the message
  const [kidPending, setKidPending] = useState<KidSignupResponse | null>(null)
  const [kidParentEmail, setKidParentEmail] = useState('')

  useEffect(() => {
    if (role !== null) {
      document.getElementById('username')?.focus()
    }
  }, [role])

  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (isEmpty(username)) errs.username = t('errors.required')
    if (role === 'kid' && isEmpty(name)) errs.name = t('errors.required')
    if (role === 'parent') {
      if (isEmpty(email)) errs.email = t('errors.required')
      else if (!isValidEmail(email)) errs.email = t('errors.invalidEmail')
    }
    if (isEmpty(password)) errs.password = t('errors.required')
    if (role === 'kid') {
      if (isEmpty(parentEmail)) errs.parentEmail = t('errors.required')
      else if (!isValidEmail(parentEmail)) errs.parentEmail = t('errors.invalidEmail')
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) return

    setError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setIsLoading(true)

    try {
      if (role === 'parent') {
        // 1. Create the parent account
        await registerParent(email, username, password)
        // 2. Auto-login so they don't have to log in manually right after signing up
        const { access, refresh } = await loginParent(email, password)
        const payload = decodeJWT(access)

        login(
          {
            id: payload.user_id as string,
            username: payload.username as string,
            email: payload.email as string,
            role: 'parent',
          },
          access,
          refresh,
        )
        navigate('/parent/dashboard')
      } else {
        // Kid signup — kid can't log in until a parent accepts the email invite
        const result = await signupKid(name, username, password, parentEmail)
        // Save parent email so we can show it on the waiting screen
        setKidParentEmail(parentEmail)
        setKidPending(result)
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // ── "Waiting for parent" screen ────────────────────────────────────────────
  // Shown after a successful kid signup. The kid can't log in yet —
  // they have to wait for the parent to accept the invite email.
  if (kidPending) {
    return (
      <main aria-labelledby="waiting-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
        <div className="text-5xl" aria-hidden="true">📬</div>
        <h1 id="waiting-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
          {t('auth.waitingForParent')}
        </h1>
        <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
          {t('auth.waitingForParentHint', { email: kidParentEmail })}
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          {t('auth.backToHome')}
        </Button>
        <LanguageSwitcher />
      </main>
    )
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <main aria-labelledby="signup-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
      <h1 id="signup-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('auth.signup')}
      </h1>

      <fieldset
        aria-labelledby="role-selector-label"
        className="flex w-80 max-w-full flex-col items-center gap-4 border-0 p-0 m-0 min-w-0"
      >
        <p
          id="role-selector-label"
          className="font-body text-sm font-semibold text-gray-700 text-center w-full m-0"
        >
          {t('auth.roleSelector')}
        </p>
        <div role="radiogroup" aria-required="true" className="flex gap-4">
          <Button
            role="radio"
            variant={role === 'parent' ? 'primary' : 'secondary'}
            onClick={() => setRole('parent')}
            aria-checked={role === 'parent'}
          >
            {t('auth.parent')}
          </Button>
          <Button
            role="radio"
            variant={role === 'kid' ? 'primary' : 'secondary'}
            onClick={() => setRole('kid')}
            aria-checked={role === 'kid'}
          >
            {t('auth.child')}
          </Button>
        </div>
      </fieldset>

      {role !== null && (
        <>
          <p className="sr-only" aria-live="polite" role="status">
            {t('a11y.signupFormReady')}
          </p>
          <form
            noValidate
            className="flex w-80 max-w-full flex-col gap-4"
            onSubmit={handleSubmit}
            aria-labelledby="signup-heading"
          >
            {error && <FormAlert message={error} />}

            <FormField
              id="username"
              label={t('auth.username')}
              type="text"
              value={username}
              required
              autoComplete="username"
              error={fieldErrors.username}
              onChange={e => {
                setUsername(e.target.value)
                clearFieldError('username')
              }}
            />

            {role === 'kid' && (
              <FormField
                id="name"
                label={t('auth.name')}
                type="text"
                value={name}
                required
                autoComplete="name"
                error={fieldErrors.name}
                onChange={e => {
                  setName(e.target.value)
                  clearFieldError('name')
                }}
              />
            )}

            {role === 'parent' && (
              <FormField
                id="email"
                label={t('auth.email')}
                type="email"
                value={email}
                placeholder={t('auth.emailHint')}
                required
                autoComplete="email"
                error={fieldErrors.email}
                onChange={e => {
                  setEmail(e.target.value)
                  clearFieldError('email')
                }}
              />
            )}

            <FormField
              id="password"
              label={t('auth.password')}
              type="password"
              value={password}
              required
              autoComplete="new-password"
              error={fieldErrors.password}
              onChange={e => {
                setPassword(e.target.value)
                clearFieldError('password')
              }}
            />

            {role === 'kid' && (
              <FormField
                id="parentEmail"
                label={t('auth.parentEmail')}
                type="email"
                value={parentEmail}
                placeholder={t('auth.emailHint')}
                required
                autoComplete="off"
                error={fieldErrors.parentEmail}
                onChange={e => {
                  setParentEmail(e.target.value)
                  clearFieldError('parentEmail')
                }}
              />
            )}

            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? t('auth.signingUp') : t('auth.signup')}
            </Button>
          </form>

          {/* Google sign-in — parents only */}
          {role === 'parent' && (
            <div className="flex flex-col items-center gap-3 w-80 max-w-full">
              <div className="flex items-center gap-3 w-full">
                <hr className="flex-1 border-gray-300" />
                <span className="font-body text-xs text-gray-400">{t('auth.orContinueWith')}</span>
                <hr className="flex-1 border-gray-300" />
              </div>
              <GoogleLogin
                key={i18n.language}
                onSuccess={async credentialResponse => {
                  if (!credentialResponse.credential) return
                  setError(null)
                  try {
                    const { access, refresh } = await loginWithGoogle(credentialResponse.credential)
                    const payload = decodeJWT(access)
                    login({
                      id: payload.user_id as string,
                      username: payload.username as string,
                      email: payload.email as string,
                      role: 'parent',
                    }, access, refresh)
                    navigate('/parent/dashboard')
                  } catch (err) {
                    setError(parseApiError(err))
                  }
                }}
                onError={() => setError(t('errors.api.invalidGoogleToken'))}
                locale={i18n.language.split('-')[0]}
                width="320"
              />
            </div>
          )}
        </>
      )}

      <p className="font-body text-sm text-gray-700 text-center">
        {t('auth.hasAccount')}{' '}
        <Link
          to="/login"
          className="font-semibold text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm"
          aria-label={t('a11y.goToLogin')}
        >
          {t('nav.login')}
        </Link>
      </p>
      <LanguageSwitcher />
    </main>
  )
}
