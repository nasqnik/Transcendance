import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import useAuthStore from '../store/authStore'
import { loginParent, loginKid, loginWithGoogle, decodeJWT, parseApiError } from '../api/auth'
import { isEmpty, isValidEmail } from '../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [role, setRole] = useState<'parent' | 'kid' | null>(null)
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

  function handleRoleChange(newRole: 'parent' | 'kid') {
    setRole(newRole)
    setIdentifier('')
    setPassword('')
    setError(null)
    setFieldErrors({})
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (isEmpty(identifier)) errs.identifier = t('errors.required')
    else if (role === 'parent' && !isValidEmail(identifier)) errs.identifier = t('errors.invalidEmail')
    if (isEmpty(password)) errs.password = t('errors.required')
    return errs
  }

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
        const { access, refresh } = await loginParent(identifier, password)
        const payload = decodeJWT(access)
        login({ id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' }, access, refresh)
        navigate('/parent/dashboard')
      } else {
        const { access, refresh } = await loginKid(identifier, password)
        const payload = decodeJWT(access)
        login({ id: payload.kid_id as string, username: payload.username as string, role: 'kid' }, access, refresh)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main aria-labelledby="login-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
      <h1 id="login-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('auth.login')}
      </h1>

      {/* Role selector */}
      <fieldset className="flex w-80 max-w-full flex-col items-center gap-4 border-0 p-0 m-0 min-w-0">
        <p className="font-body text-sm font-semibold text-gray-700 text-center w-full m-0">
          {t('auth.roleSelector')}
        </p>
        <div role="radiogroup" aria-required="true" className="flex gap-4">
          <Button
            role="radio"
            variant={role === 'parent' ? 'primary' : 'secondary'}
            onClick={() => handleRoleChange('parent')}
            aria-checked={role === 'parent'}
          >
            {t('auth.parent')}
          </Button>
          <Button
            role="radio"
            variant={role === 'kid' ? 'primary' : 'secondary'}
            onClick={() => handleRoleChange('kid')}
            aria-checked={role === 'kid'}
          >
            {t('auth.child')}
          </Button>
        </div>
      </fieldset>

      {role !== null && (
        <>
          <p className="sr-only" aria-live="polite" role="status">
            {t('a11y.loginFormReady')}
          </p>
          <form
            noValidate
            className="flex w-80 max-w-full flex-col gap-4"
            onSubmit={handleSubmit}
            aria-labelledby="login-heading"
          >
            {error && <FormAlert message={error} />}

            <FormField
              id="identifier"
              label={role === 'parent' ? t('auth.email') : t('auth.username')}
              type={role === 'parent' ? 'email' : 'text'}
              value={identifier}
              placeholder={role === 'parent' ? t('auth.emailHint') : undefined}
              required
              autoComplete={role === 'parent' ? 'email' : 'username'}
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
              {role === 'parent' && (
                <Link
                  to="/forgot-password"
                  className="font-body text-sm text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm ltr:self-end rtl:self-start"
                >
                  {t('auth.forgotPassword')}
                </Link>
              )}
            </div>

            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? t('auth.loggingIn') : t('auth.login')}
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
                    login({ id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' }, access, refresh)
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
