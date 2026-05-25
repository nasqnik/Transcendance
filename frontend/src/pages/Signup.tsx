import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import AuthMessageLayout from '../components/AuthMessageLayout'
import GoogleSignInSection from '../components/GoogleSignInSection'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import { establishParentSession } from '../auth/session'
import {
  registerParent,
  loginWithGoogle,
  signupKid,
  signupKidWithGoogle,
  parseApiError,
  type KidSignupResponse,
} from '../api/auth'
import { useFormErrors } from '../hooks/useFormErrors'
import { usePageTitle } from '../hooks/usePageTitle'
import { isEmpty, isValidEmail, validatePasswordField } from '../utils/validation'

export default function Signup() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  usePageTitle(`${t('auth.signup')} — ${t('app.name')}`)
  const [role, setRole] = useState<'parent' | 'kid' | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')        // parent email
  const [kidEmail, setKidEmail] = useState('')  // kid's own email (password signup)
  const [password, setPassword] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()
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

  function selectRole(next: 'parent' | 'kid') {
    setRole(next)
    setError(null)
    resetFieldErrors()
    setUsername('')
    setName('')
    setEmail('')
    setKidEmail('')
    setPassword('')
    setParentEmail('')
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
    const passwordError = validatePasswordField(password, t, {
      username,
      email: role === 'parent' ? email : kidEmail,
    })
    if (passwordError) errs.password = passwordError
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
    resetFieldErrors()
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
    resetFieldErrors()
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
      <AuthMessageLayout
        headingId="verify-heading"
        icon="📬"
        title={t('auth.verifyYourEmail')}
        statusMessage={t('auth.verifyYourEmail')}
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('auth.verifyEmailHint', { email: parentPendingEmail })}
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          {t('auth.backToHome')}
        </Button>
        <p className="font-body text-sm text-gray-700 text-center">
          {t('auth.verifyEmailAlready')}{' '}
          <Link
            to="/login"
            className="font-semibold text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm"
          >
            {t('auth.login')}
          </Link>
        </p>
      </AuthMessageLayout>
    )
  }

  // ── Kid waiting screen ────────────────────────────────────────────────────
  if (kidPending) {
    const emailVerified = kidPending.email_verified
    return (
      <AuthMessageLayout
        headingId="waiting-heading"
        icon="📬"
        title={emailVerified ? t('auth.waitingForParent') : t('auth.almostThere')}
        statusMessage={emailVerified ? t('auth.waitingForParent') : t('auth.almostThere')}
      >
        {!emailVerified && (
          <p className="font-body text-sm text-gray-700 text-center w-full">
            {t('auth.kidStep1', { email: kidPending.email })}
          </p>
        )}
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {emailVerified
            ? t('auth.waitingForParentHint', { email: kidParentEmail })
            : t('auth.kidStep2', { email: kidParentEmail })}
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          {t('auth.backToHome')}
        </Button>
      </AuthMessageLayout>
    )
  }

  // ── Kid Google "complete your profile" screen ─────────────────────────────
  if (kidGoogleToken) {
    return (
      <AuthMessageLayout
        headingId="google-profile-heading"
        icon="👤"
        title={t('auth.completeProfile')}
      >
        <form
          noValidate
          className="flex w-full flex-col gap-4"
          onSubmit={handleGoogleKidSubmit}
          aria-labelledby="google-profile-heading"
          aria-busy={isLoading}
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
            dir="ltr"
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

          <Button variant="secondary" onClick={() => { setKidGoogleToken(null); setError(null); resetFieldErrors() }}>
            {t('auth.back')}
          </Button>
        </form>
      </AuthMessageLayout>
    )
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <main aria-labelledby="signup-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
      <h1 id="signup-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('auth.signup')}
      </h1>

      <fieldset className="flex w-80 max-w-full flex-col items-center gap-4 border-0 p-0 m-0 min-w-0">
        <legend className="font-body text-sm font-semibold text-gray-700 text-center w-full px-0">
          {t('auth.roleSelector')}
        </legend>
        <div className="flex gap-4">
          <label
            className={`font-body font-semibold px-6 py-3 rounded-xl focus-ring cursor-pointer ${
              role === 'parent'
                ? 'bg-primary-500 text-white'
                : 'border-2 border-primary-500 text-primary-500'
            }`}
          >
            <input
              type="radio"
              name="signup-role"
              value="parent"
              checked={role === 'parent'}
              onChange={() => selectRole('parent')}
              className="sr-only"
            />
            {t('auth.parent')}
          </label>
          <label
            className={`font-body font-semibold px-6 py-3 rounded-xl focus-ring cursor-pointer ${
              role === 'kid'
                ? 'bg-primary-500 text-white'
                : 'border-2 border-primary-500 text-primary-500'
            }`}
          >
            <input
              type="radio"
              name="signup-role"
              value="kid"
              checked={role === 'kid'}
              onChange={() => selectRole('kid')}
              className="sr-only"
            />
            {t('auth.child')}
          </label>
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
            aria-busy={isLoading}
          >
            {error && <FormAlert message={error} />}

            <FormField
              id="username"
              label={t('auth.username')}
              type="text"
              dir="ltr"
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
          <GoogleSignInSection
            onSuccess={async credential => {
              setError(null)
              if (role === 'parent') {
                try {
                  const tokens = await loginWithGoogle(credential)
                  establishParentSession(tokens, navigate)
                } catch (err) {
                  setError(parseApiError(err))
                }
              } else {
                setKidGoogleToken(credential)
              }
            }}
            onError={() => setError(t('errors.api.invalidGoogleToken'))}
          />
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
