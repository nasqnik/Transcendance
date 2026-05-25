import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthMessageLayout from '../components/AuthMessageLayout'
import Button from '../components/Button'
import { verifyKidEmail } from '../api/auth'
import { getApiErrorKey, parseApiError } from '../api/errors'
import useAuthStore from '../store/authStore'
import { PARENT_DASHBOARD_PATH } from '../auth/session'

type PageState = 'loading' | 'success' | 'active' | 'error'

export default function VerifyKidEmail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, currentUser, logout } = useAuthStore()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const parentLoggedIn = isAuthenticated && currentUser?.role === 'parent'
  const [state, setState] = useState<PageState>(() => token ? 'loading' : 'error')
  const [errorMessage, setErrorMessage] = useState(() => token ? '' : t('verify.invalidLink'))
  const [linkAlreadyUsed, setLinkAlreadyUsed] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyKidEmail(token)
      .then(data => {
        if (cancelled) return
        if (data?.registration_status === 'active') {
          setState('active')
        } else {
          setState('success')
        }
      })
      .catch(err => {
        if (cancelled) return
        const key = getApiErrorKey(err)
        if (key === 'errors.api.alreadyVerified') {
          setState('success')
          return
        }
        if (key === 'errors.api.invalidVerificationToken') {
          setLinkAlreadyUsed(true)
          setErrorMessage(t('verify.linkAlreadyUsed'))
          setState('error')
          return
        }
        setLinkAlreadyUsed(false)
        setErrorMessage(parseApiError(err))
        setState('error')
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- language changes must not re-trigger verification
  }, [searchParams])

  if (state === 'loading') {
    return (
      <AuthMessageLayout
        headingId="verify-heading"
        title={t('verify.loading')}
        statusMessage={t('verify.loading')}
      />
    )
  }

  function kidVerifyActions(loginPrimary: boolean) {
    if (parentLoggedIn) {
      return (
        <>
          <p className="font-body text-sm text-gray-700 text-center w-full">
            {t('verify.kidVerifiedParentSession')}
          </p>
          <Button variant="primary" onClick={() => { logout(); navigate('/login') }}>
            {t('nav.logout')}
          </Button>
          <Button variant="secondary" onClick={() => navigate(PARENT_DASHBOARD_PATH)}>
            {t('invite.goToDashboard')}
          </Button>
        </>
      )
    }
    return (
      <>
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {state === 'active' ? t('verify.allSetHint') : t('verify.kidSuccessHint')}
        </p>
        <Button variant="primary" onClick={() => navigate(loginPrimary ? '/login' : '/')}>
          {loginPrimary ? t('auth.login') : t('auth.backToHome')}
        </Button>
      </>
    )
  }

  if (state === 'success') {
    return (
      <AuthMessageLayout
        headingId="verify-heading"
        icon="✅"
        title={t('verify.successTitle')}
        statusMessage={t('verify.successTitle')}
      >
        {kidVerifyActions(false)}
      </AuthMessageLayout>
    )
  }

  if (state === 'active') {
    return (
      <AuthMessageLayout
        headingId="verify-heading"
        icon="🎉"
        title={t('verify.allSetTitle')}
        statusMessage={t('verify.allSetTitle')}
      >
        {kidVerifyActions(true)}
      </AuthMessageLayout>
    )
  }

  return (
    <AuthMessageLayout
      headingId="verify-heading"
      icon={linkAlreadyUsed ? '✅' : '❌'}
      title={linkAlreadyUsed ? t('verify.successTitle') : t('verify.errorTitle')}
      alertMessage={linkAlreadyUsed ? undefined : errorMessage}
      statusMessage={errorMessage}
      titleSize="md"
    >
      {linkAlreadyUsed && (
        parentLoggedIn ? (
          <>
            <p className="font-body text-sm text-gray-700 text-center w-full">
              {t('verify.kidVerifiedParentSession')}
            </p>
            <Button variant="primary" onClick={() => { logout(); navigate('/login') }}>
              {t('nav.logout')}
            </Button>
          </>
        ) : (
          <p className="font-body text-sm text-gray-700 text-center w-full">
            {t('verify.kidSuccessHint')}
          </p>
        )
      )}
      {!linkAlreadyUsed || !parentLoggedIn ? (
        <Button variant="primary" onClick={() => navigate(parentLoggedIn ? PARENT_DASHBOARD_PATH : '/')}>
          {parentLoggedIn ? t('invite.goToDashboard') : t('auth.backToHome')}
        </Button>
      ) : null}
    </AuthMessageLayout>
  )
}
