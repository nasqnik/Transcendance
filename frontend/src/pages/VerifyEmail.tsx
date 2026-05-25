import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthMessageLayout from '../components/AuthMessageLayout'
import Button from '../components/Button'
import { verifyParentEmail } from '../api/auth'
import { getApiErrorKey, parseApiError } from '../api/errors'
import { acceptInvitePath, getPendingInviteToken } from '../utils/inviteToken'

type PageState = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<PageState>(() => token ? 'loading' : 'error')
  const [errorMessage, setErrorMessage] = useState(() => token ? '' : t('verify.invalidLink'))
  const [linkAlreadyUsed, setLinkAlreadyUsed] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyParentEmail(token)
      .then(() => {
        if (!cancelled) setState('success')
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

  if (state === 'success') {
    const pendingInvite = getPendingInviteToken()
    return (
      <AuthMessageLayout
        headingId="verify-heading"
        icon="✅"
        title={t('verify.successTitle')}
        statusMessage={t('verify.successTitle')}
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {pendingInvite
            ? t('verify.parentSuccessReturnInvite')
            : t('verify.parentSuccessHint')}
        </p>
        {pendingInvite ? (
          <Button
            variant="primary"
            onClick={() => navigate(acceptInvitePath(pendingInvite))}
          >
            {t('invite.returnToInvite')}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/login')}>
            {t('auth.login')}
          </Button>
        )}
      </AuthMessageLayout>
    )
  }

  const pendingInvite = getPendingInviteToken()

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
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {pendingInvite
            ? t('verify.parentSuccessReturnInvite')
            : t('verify.parentSuccessHint')}
        </p>
      )}
      {linkAlreadyUsed && pendingInvite ? (
        <Button
          variant="primary"
          onClick={() => navigate(acceptInvitePath(pendingInvite))}
        >
          {t('invite.returnToInvite')}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => navigate(linkAlreadyUsed ? '/login' : '/')}>
          {linkAlreadyUsed ? t('auth.login') : t('auth.backToHome')}
        </Button>
      )}
    </AuthMessageLayout>
  )
}
