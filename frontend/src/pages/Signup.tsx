import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import useAuthStore from '../store/authStore'
import {
  registerParent,
  loginWithGoogle,
  signupKid,
  signupKidWithGoogle,
  decodeJWT,
  parseApiError,
  type KidSignupResponse,
} from '../api/auth'
import { isEmpty, isValidEmail } from '../utils/validation'

export default function Signup() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [role, setRole] = useState<'parent' | 'kid' | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')        // parent email
  const [kidEmail, setKidEmail] = useState('')  // kid's own email (password signup)
  const [password, setPassword] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  // After parent signup: show "check your email" screen
  const [parentPendingEmail, setParentPendingEmail] = useState<string | null>(null)

  // After kid signup: show waiting screen
  const [kidPending, setKidPending] = useState<KidSignupResponse | null>(null)
  const [kidParentEmail, setKidParentEmail] = useState('')

  // Kid Google signup: store id_token after Google popup, then collect remaining fields
  const [kidGoogleToken, setKidGoogleToken] = useState<string | null>(null)

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

  // ── Password signup validation ────────────────────────────────────────────
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (isEmpty(username)) errs.username = t('errors.required')
    if (role === 'kid' && isEmpty(name)) errs.name = t('errors.required')
    if (role === 'parent') {
      if (isEmpty(email)) errs.email = t('errors.required')
      else if (!isValidEmail(email)) errs.email = t('errors.invalidEmail')
    }
    if (role === 'kid') {
      if (isEmpty(kidEmail)) errs.kidEmail = t('errors.required')
      else if (!isValidEmail(kidEmail)) errs.kidEmail = t('errors.invalidEmail')
    }
    if (isEmpty(password)) errs.password = t('errors.required')
    if (role === 'kid') {
      if (isEmpty(parentEmail)) errs.parentEmail = t('errors.required')
      else if (!isValidEmail(parentEmail)) errs.parentEmail = t('errors.invalidEmail')
    }
    return errs
  }

  // ── Kid Google profile validation ─────────────────────────────────────────
  function validateGoogleKid(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (isEmpty(name)) errs.name = t('errors.required')
    if (isEmpty(username)) errs.username = t('errors.required')
    if (isEmpty(parentEmail)) errs.parentEmail = t('errors.required')
    else if (!isValidEmail(parentEmail)) errs.parentEmail = t('errors.invalidEmail')
    return errs
  }

  // ── Password signup submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) return
    setError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setIsLoading(true)

    try {
      if (role === 'parent') {
        await registerParent(email, username, password)
        setParentPendingEmail(email)
      } else {
        const result = await signupKid(name, username, kidEmail, password, parentEmail)
        setKidParentEmail(parentEmail)
        setKidPending(result)
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Kid Google profile submit ─────────────────────────────────────────────
  async function handleGoogleKidSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!kidGoogleToken) return
    setError(null)

    const errs = validateGoogleKid()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setIsLoading(true)

    try {
      const result = await signupKidWithGoogle(kidGoogleToken, name, username, parentEmail)
      setKidParentEmail(parentEmail)
      setKidPending(result)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Parent "check your email" screen ─────────────────────────────────────
  if (parentPendingEmail) {
    return (
      <main aria-labelledby="verify-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
        <div className="text-5xl" aria-hidden="true">📬</div>
        <h1 id="verify-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
          {t('auth.verifyYourEmail')}
        </h1>
        <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
          {t('auth.verifyEmailHint', { email: parentPendingEmail })}
        </p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          {t('auth.login')}
        </Button>
        <LanguageSwitcher />
      </main>
    )
  }

  // ── Kid waiting screen ────────────────────────────────────────────────────
  if (kidPending) {
    const emailVerified = kidPending.email_verified
    return (
      <main aria-labelledby="waiting-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
        <div className="text-5xl" aria-hidden="true">📬</div>
        <h1 id="waiting-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
          {emailVerified ? t('auth.waitingForParent') : t('auth.almostThere')}
        </h1>
        {!emailVerified && (
          <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
            {t('auth.kidStep1', { email: kidPending.email })}
          </p>
        )}
        <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
          {emailVerified
            ? t('auth.waitingForParentHint', { email: kidParentEmail })
            : t('auth.kidStep2', { email: kidParentEmail })}
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          {t('auth.backToHome')}
        </Button>
        <LanguageSwitcher />
      </main>
    )
  }

  // ── Kid Google "complete your profile" screen ─────────────────────────────
  if (kidGoogleToken) {
    return (
      <main aria-labelledby="google-profile-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
        <div className="text-5xl" aria-hidden="true">👤</div>
        <h1 id="google-profile-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
          {t('auth.completeProfile')}
        </h1>
        <form
          noValidate
          className="flex w-80 max-w-full flex-col gap-4"
          onSubmit={handleGoogleKidSubmit}
          aria-labelledby="google-profile-heading"
        >
          {error && <FormAlert message={error} />}

          <FormField
            id="name"
            label={t('auth.name')}
            type="text"
            value={name}
            required
            autoComplete="name"
            error={fieldErrors.name}
            onChange={e => { setName(e.target.value); clearFieldError('name') }}
          />

          <FormField
            id="username"
            label={t('auth.username')}
            type="text"
            value={username}
            required
            autoComplete="username"
            error={fieldErrors.username}
            onChange={e => { setUsername(e.target.value); clearFieldError('username') }}
          />

          <FormField
            id="parentEmail"
            label={t('auth.parentEmail')}
            type="email"
            value={parentEmail}
            placeholder={t('auth.emailHint')}
            required
            autoComplete="off"
            error={fieldErrors.parentEmail}
            onChange={e => { setParentEmail(e.target.value); clearFieldError('parentEmail') }}
          />

          <Button variant="primary" type="submit" disabled={isLoading}>
            {isLoading ? t('auth.signingUp') : t('auth.signup')}
          </Button>

          <Button variant="secondary" onClick={() => { setKidGoogleToken(null); setError(null); setFieldErrors({}) }}>
            {t('auth.back')}
          </Button>
        </form>
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
        <p id="role-selector-label" className="font-body text-sm font-semibold text-gray-700 text-center w-full m-0">
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
              onChange={e => { setUsername(e.target.value); clearFieldError('username') }}
            />

            {role === 'kid' && (
              <FormField
                id="kidEmail"
                label={t('auth.email')}
                type="email"
                value={kidEmail}
                placeholder={t('auth.emailHint')}
                required
                autoComplete="email"
                error={fieldErrors.kidEmail}
                onChange={e => { setKidEmail(e.target.value); clearFieldError('kidEmail') }}
              />
            )}

            {role === 'kid' && (
              <FormField
                id="name"
                label={t('auth.name')}
                type="text"
                value={name}
                required
                autoComplete="name"
                error={fieldErrors.name}
                onChange={e => { setName(e.target.value); clearFieldError('name') }}
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
                onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
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
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
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
                onChange={e => { setParentEmail(e.target.value); clearFieldError('parentEmail') }}
              />
            )}

            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? t('auth.signingUp') : t('auth.signup')}
            </Button>
          </form>

          {/* Google sign-in — both parent and kid */}
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
                if (role === 'parent') {
                  try {
                    const { access, refresh } = await loginWithGoogle(credentialResponse.credential)
                    const payload = decodeJWT(access)
                    login({ id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' }, access, refresh)
                    navigate('/parent/dashboard')
                  } catch (err) {
                    setError(parseApiError(err))
                  }
                } else {
                  // Kid — store token and show "complete your profile" form
                  setKidGoogleToken(credentialResponse.credential)
                }
              }}
              onError={() => setError(t('errors.api.invalidGoogleToken'))}
              locale={i18n.language.split('-')[0]}
              width="320"
            />
          </div>
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
