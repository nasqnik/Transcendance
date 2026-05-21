import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import useAuthStore from '../store/authStore'
import { loginParent, loginKid, decodeJWT, parseApiError } from '../api/auth'
import { isEmpty, isValidEmail } from '../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const isEmail = identifier.includes('@')

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
    if (isEmpty(identifier)) errs.identifier = t('errors.required')
    else if (isEmail && !isValidEmail(identifier)) errs.identifier = t('errors.invalidEmail')
    if (isEmpty(password)) errs.password = t('errors.required')
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setIsLoading(true)

    try {
      if (isEmail) {
        const { access, refresh } = await loginParent(identifier, password)
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
        const { access, refresh } = await loginKid(identifier, password)
        const payload = decodeJWT(access)
        login(
          {
            id: payload.kid_id as string,
            username: payload.username as string,
            role: 'kid',
          },
          access,
          refresh,
        )
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
          onChange={e => {
            setIdentifier(e.target.value)
            clearFieldError('identifier')
          }}
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
            onChange={e => {
              setPassword(e.target.value)
              clearFieldError('password')
            }}
          />
          {isEmail && (
            <Link
              to="/forgot-password"
              className="font-body text-sm text-primary-600 underline hover:text-primary-700 focus-ring rounded-sm self-end"
            >
              {t('auth.forgotPassword')}
            </Link>
          )}
        </div>

        <Button variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>

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
