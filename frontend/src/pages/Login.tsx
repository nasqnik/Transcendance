import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { attemptDualRoleLogin } from '../auth/loginFlow'
import AuthMessageLayout from '../components/AuthMessageLayout'
import GoogleSignInSection from '../components/GoogleSignInSection'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import FormAlert from '../components/FormAlert'
import FormField from '../components/FormField'
import { useFormErrors } from '../hooks/useFormErrors'
import { usePageTitle } from '../hooks/usePageTitle'
import { isEmpty } from '../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  usePageTitle(`${t('auth.login')} — ${t('app.name')}`)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [waitingForParent, setWaitingForParent] = useState(false)

  async function runLogin(credentials: Parameters<typeof attemptDualRoleLogin>[0]) {
    setErrorKey(null)
    resetFieldErrors()
    setWaitingForParent(false)
    setIsLoading(true)

    try {
      const result = await attemptDualRoleLogin(credentials, navigate)
      if (result.status === 'waiting_for_parent') {
        setWaitingForParent(true)
      } else if (result.status === 'error') {
        setErrorKey(result.errorKey)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs: Record<string, string> = {}
    if (isEmpty(identifier)) errs.identifier = t('errors.required')
    if (isEmpty(password)) errs.password = t('errors.required')
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    await runLogin({ type: 'password', identifier, password })
  }

  if (waitingForParent) {
    return (
      <AuthMessageLayout
        headingId="waiting-heading"
        icon="📬"
        title={t('auth.waitingForParent')}
        statusMessage={t('auth.waitingForParent')}
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('auth.waitingForParentHintGeneric')}
        </p>
        <Button variant="primary" onClick={() => setWaitingForParent(false)}>
          {t('auth.tryLoginAgain')}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('auth.backToHome')}
        </Button>
      </AuthMessageLayout>
    )
  }

  return (
    <main aria-labelledby="login-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">
      <h1 id="login-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('auth.login')}
      </h1>

      <p className="sr-only" id="login-form-hint">
        {t('a11y.loginFormReady')}
      </p>

      <form
        noValidate
        className="flex w-80 max-w-full flex-col gap-4"
        onSubmit={handleSubmit}
        aria-labelledby="login-heading"
        aria-describedby="login-form-hint"
        aria-busy={isLoading}
      >
        {errorKey && <FormAlert message={t(errorKey)} />}

        <FormField
          id="identifier"
          label={t('auth.emailOrUsername')}
          type="text"
          dir="ltr"
          value={identifier}
          placeholder={t('auth.emailOrUsernameHint')}
          required
          autoComplete="username"
          disabled={isLoading}
          error={fieldErrors.identifier}
          onChange={e => { setIdentifier(e.target.value); clearFieldError('identifier') }}
        />

        <FormField
          id="password"
          label={t('auth.password')}
          type="password"
          value={password}
          required
          autoComplete="current-password"
          disabled={isLoading}
          error={fieldErrors.password}
          onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
        />

        <Button variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>

      <GoogleSignInSection
        disabled={isLoading}
        onSuccess={credential => runLogin({ type: 'google', credential })}
        onError={() => { resetFieldErrors(); setErrorKey('errors.api.invalidGoogleToken') }}
      />

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
