import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import useAuthStore from '../store/authStore'
import { loginParent, loginKid, loginWithGoogle, loginKidWithGoogle, decodeJWT, parseApiError } from '../api/auth'
import { isEmpty } from '../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errs: Record<string, string> = {}
    if (isEmpty(identifier)) errs.identifier = t('errors.required')
    if (isEmpty(password)) errs.password = t('errors.required')
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setIsLoading(true)

    try {
      // Try both parent and kid login simultaneously — whichever succeeds wins
      const [parentResult, kidResult] = await Promise.allSettled([
        loginParent(identifier, password),
        loginKid(identifier, password),
      ])

      if (parentResult.status === 'fulfilled') {
        const { access, refresh } = parentResult.value
        const payload = decodeJWT(access)
        login({ id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' }, access, refresh)
        navigate('/parent/dashboard')
      } else if (kidResult.status === 'fulfilled') {
        const { access, refresh } = kidResult.value
        const payload = decodeJWT(access)
        login({ id: payload.kid_id as string, username: payload.username as string, role: 'kid' }, access, refresh)
        navigate('/dashboard')
      } else {
        // Both failed — show whichever error is more specific
        setError(parseApiError(parentResult.reason ?? kidResult.reason))
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError(null)
    try {
      // Try parent Google first, fall back to kid
      try {
        const { access, refresh } = await loginWithGoogle(credential)
        const payload = decodeJWT(access)
        login({ id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' }, access, refresh)
        navigate('/parent/dashboard')
      } catch {
        const { access, refresh } = await loginKidWithGoogle(credential)
        const payload = decodeJWT(access)
        login({ id: payload.kid_id as string, username: payload.username as string, role: 'kid' }, access, refresh)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  return (
    <main aria-labelledby="login-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
      <h1 id="login-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('auth.login')}
      </h1>

      <form
        noValidate
        className="flex w-80 max-w-full flex-col gap-4"
        onSubmit={handleSubmit}
        aria-labelledby="login-heading"
      >
        {error && <FormAlert message={error} />}

        <FormField
          id="identifier"
          label={t('auth.emailOrUsername')}
          type="text"
          value={identifier}
          placeholder={t('auth.emailOrUsernamHint')}
          required
          autoComplete="username"
          error={fieldErrors.identifier}
          onChange={e => { setIdentifier(e.target.value); clearFieldError('identifier') }}
        />

        <div className="flex flex-col gap-1">
          <FormField
            id="password"
            label={t('auth.password')}
            type="password"
            value={password}
            required
            autoComplete="current-password"
            error={fieldErrors.password}
            onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
          />
          <Link
            to="/forgot-password"
            className="font-body text-sm text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm ltr:self-end rtl:self-start"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-3 w-80 max-w-full">
        <div className="flex items-center gap-3 w-full">
          <hr className="flex-1 border-gray-300" />
          <span className="font-body text-xs text-gray-400">{t('auth.orContinueWith')}</span>
          <hr className="flex-1 border-gray-300" />
        </div>
        <GoogleLogin
          key={i18n.language}
          onSuccess={credentialResponse => {
            if (credentialResponse.credential) handleGoogleSuccess(credentialResponse.credential)
          }}
          onError={() => setError(t('errors.api.invalidGoogleToken'))}
          locale={i18n.language.split('-')[0]}
          width="320"
        />
      </div>

      <p className="font-body text-sm text-gray-700 text-center">
        {t('auth.noAccount')}{' '}
        <Link
          to="/signup"
          className="font-semibold text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm"
          aria-label={t('a11y.goToSignup')}
        >
          {t('nav.signup')}
        </Link>
      </p>
      <LanguageSwitcher />
    </main>
  )
}
