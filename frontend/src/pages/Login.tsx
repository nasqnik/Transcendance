import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import Input from '../components/Input'
import useAuthStore from '../store/authStore'
import { loginParent, loginKid, decodeJWT, parseApiError } from '../api/auth'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const login = useAuthStore(state => state.login)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // If the input contains @ we treat it as an email → parent login
  // Otherwise it's a username → kid login
  const isEmail = identifier.includes('@')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
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
        className="flex w-80 max-w-full flex-col gap-4"
        onSubmit={handleSubmit}
        aria-labelledby="login-heading"
      >
        {error && (
          <p role="alert" className="font-body text-sm text-red-600 text-center bg-red-50 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="identifier" className="font-body text-sm font-semibold text-gray-700">
            {t('auth.emailOrUsername')}
          </label>
          <Input
            id="identifier"
            type="text"
            value={identifier}
            placeholder={t('auth.emailOrUsernamHint')}
            required
            autoComplete="username"
            onChange={e => setIdentifier(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="font-body text-sm font-semibold text-gray-700">
            {t('auth.password')}
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
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
