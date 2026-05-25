import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthMessageLayout from '../components/AuthMessageLayout'
import GoogleSignInSection from '../components/GoogleSignInSection'
import Button from '../components/Button'
import FormField from '../components/FormField'
import FormAlert from '../components/FormAlert'
import { establishParentSession, parentUserFromAccessToken } from '../auth/session'
import useAuthStore from '../store/authStore'
import {
  getInvitation,
  acceptInvitation,
  loginParent,
  loginWithGoogle,
  registerParent,
  type InvitationDetails,
} from '../api/auth'
import {
  isAccountNotFound,
  isEmailNotVerified,
  isInvitationAlreadyAccepted,
  getApiErrorKey,
  getFieldErrors,
} from '../api/errors'
import {
  acceptInvitePath,
  clearPendingInviteToken,
  savePendingInviteToken,
} from '../utils/inviteToken'
import { useAuthHydrated } from '../hooks/useAuthHydrated'
import { useFormErrors } from '../hooks/useFormErrors'
import { usePageTitle } from '../hooks/usePageTitle'
import { emailsMatchIgnoreCase, isEmpty, validatePasswordField } from '../utils/validation'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; messageKey: string }
  | { status: 'form'; invitation: InvitationDetails }
  | { status: 'wrong_account'; invitation: InvitationDetails; loggedInEmail: string }
  | { status: 'verify_email'; email: string }
  | { status: 'accepting' }
  | { status: 'success'; kidName: string }

export default function AcceptInvite() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  usePageTitle(`${t('invite.title')} — ${t('app.name')}`)
  const [searchParams] = useSearchParams()
  const hydrated = useAuthHydrated()
  const { isAuthenticated, currentUser, logout } = useAuthStore()
  const inviteToken = searchParams.get('token')

  const [state, setState] = useState<PageState>(() =>
    inviteToken ? { status: 'loading' } : { status: 'error', messageKey: 'invite.notFound' }
  )

  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const autoAcceptTokenRef = useRef<string | null>(null)

  useEffect(() => {
    autoAcceptTokenRef.current = null
  }, [inviteToken])

  // ── Load invitation (after persist hydrates; not on language change) ──
  useEffect(() => {
    if (!hydrated) return

    if (!inviteToken) {
      clearPendingInviteToken()
      return
    }

    let cancelled = false

    getInvitation(inviteToken)
      .then(invitation => {
        if (cancelled) return

        if (invitation.status === 'accepted') {
          clearPendingInviteToken()
          setState({ status: 'success', kidName: invitation.kid_name })
          return
        }

        if (invitation.status !== 'pending') {
          clearPendingInviteToken()
          if (invitation.status === 'expired') {
            setState({ status: 'error', messageKey: 'invite.expired' })
          } else {
            setState({ status: 'error', messageKey: 'invite.notPending' })
          }
          return
        }

        if (isAuthenticated && currentUser?.role === 'parent') {
          if (!emailsMatchIgnoreCase(currentUser.email, invitation.invite_email)) {
            savePendingInviteToken(inviteToken)
            setState({ status: 'wrong_account', invitation, loggedInEmail: currentUser.email! })
          } else if (autoAcceptTokenRef.current !== inviteToken) {
            autoAcceptTokenRef.current = inviteToken
            void doAccept(invitation)
          } else {
            setState(prev =>
              prev.status === 'accepting' || prev.status === 'success'
                ? prev
                : { status: 'accepting' },
            )
          }
        } else if (isAuthenticated && currentUser?.role === 'kid') {
          clearPendingInviteToken()
          setState({ status: 'error', messageKey: 'invite.parentOnly' })
        } else {
          savePendingInviteToken(inviteToken)
          setState(prev => {
            if (prev.status === 'verify_email' || prev.status === 'accepting') {
              return prev
            }
            return { status: 'form', invitation }
          })
          if (invitation.invited_username_hint) {
            setUsername(prev => prev || invitation.invited_username_hint)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearPendingInviteToken()
          setState({ status: 'error', messageKey: 'invite.notFound' })
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit `t` (language changes must not re-fetch)
  }, [hydrated, inviteToken, isAuthenticated, currentUser?.email, currentUser?.role])

  // ── Accept the invitation ─────────────────────────────────────────────────
  async function doAccept(invitation: InvitationDetails) {
    setState({ status: 'accepting' })
    try {
      await acceptInvitation(invitation.token)
      clearPendingInviteToken()
      setState({ status: 'success', kidName: invitation.kid_name })
    } catch (err) {
      if (isInvitationAlreadyAccepted(err)) {
        clearPendingInviteToken()
        setState({ status: 'success', kidName: invitation.kid_name })
        return
      }
      setState({ status: 'error', messageKey: getApiErrorKey(err) })
    }
  }

  // ── Form submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    if (state.status !== 'form') return

    setFormErrorKey(null)
    const errs: Record<string, string> = {}
    if (isEmpty(username)) errs.username = t('errors.required')
    const passwordError = validatePasswordField(password, t, {
      username,
      email: state.invitation.invite_email,
    })
    if (passwordError) errs.password = passwordError
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    resetFieldErrors()
    setIsSubmitting(true)

    const { invitation } = state

    try {
      // Try login first — works if the parent already has an account
      const tokens = await loginParent(invitation.invite_email, password)
      establishParentSession(tokens)
      await doAccept(invitation)

    } catch (err) {
      if (isAccountNotFound(err)) {
        // No account yet — register, then ask them to verify email before coming back
        try {
          await registerParent(invitation.invite_email, username, password)
          setState({
            status: 'verify_email',
            email: invitation.invite_email,
          })
        } catch (registerErr) {
          const fields = getFieldErrors(registerErr)
          if (Object.keys(fields).length > 0) { setFieldErrors(fields); return }
          setFormErrorKey(getApiErrorKey(registerErr))
        }
      } else if (isEmailNotVerified(err)) {
        setState({
          status: 'verify_email',
          email: invitation.invite_email,
        })
      } else {
        setFormErrorKey(getApiErrorKey(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Google sign-in (parent must use the invited email) ────────────────────
  async function handleGoogleAccept(invitation: InvitationDetails, credential: string) {
    setFormErrorKey(null)
    resetFieldErrors()
    setIsSubmitting(true)

    try {
      const tokens = await loginWithGoogle(credential)
      const user = parentUserFromAccessToken(tokens.access)

      if (!emailsMatchIgnoreCase(user.email, invitation.invite_email)) {
        establishParentSession(tokens)
        savePendingInviteToken(invitation.token)
        setState({
          status: 'wrong_account',
          invitation,
          loggedInEmail: user.email!,
        })
        return
      }

      establishParentSession(tokens)
      await doAccept(invitation)
    } catch (err) {
      setFormErrorKey(getApiErrorKey(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!hydrated || state.status === 'loading') {
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        title={t('invite.loading')}
        statusMessage={t('invite.loading')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        icon="❌"
        title={t('invite.errorTitle')}
        alertMessage={t(state.messageKey)}
        statusMessage={t(state.messageKey)}
        titleSize="md"
      >
        {isAuthenticated && currentUser?.role === 'kid' ? (
          <Button
            variant="primary"
            onClick={() => {
              logout()
              navigate(acceptInvitePath(inviteToken!))
            }}
          >
            {t('nav.logout')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/')}>
            {t('auth.backToHome')}
          </Button>
        )}
      </AuthMessageLayout>
    )
  }

  if (state.status === 'verify_email') {
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        icon="📬"
        title={t('auth.verifyYourEmail')}
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('invite.verifyThenReturn', { email: state.email })}
        </p>
        {inviteToken && (
          <Button
            variant="primary"
            onClick={() => navigate(acceptInvitePath(inviteToken))}
          >
            {t('invite.returnToInvite')}
          </Button>
        )}
      </AuthMessageLayout>
    )
  }

  if (state.status === 'form') {
    return (
      <AuthMessageLayout headingId="invite-heading" icon="👋" title={t('invite.title')}>
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('invite.subtitle', { name: state.invitation.kid_name })}
        </p>
        <p className="font-body text-xs text-gray-500 text-center w-full">
          {t('invite.invitedAs', { email: state.invitation.invite_email })}
        </p>

        <form
          noValidate
          className="flex w-full flex-col gap-4"
          onSubmit={handleSubmit}
          aria-labelledby="invite-heading"
          aria-busy={isSubmitting}
        >
          {formErrorKey && <FormAlert message={t(formErrorKey)} />}

          <FormField
            id="username"
            label={t('auth.username')}
            type="text"
            dir="ltr"
            value={username}
            required
            autoComplete="username"
            disabled={isSubmitting}
            error={fieldErrors.username}
            onChange={e => { setUsername(e.target.value); clearFieldError('username') }}
          />

          <FormField
            id="password"
            label={t('auth.password')}
            type="password"
            value={password}
            required
            autoComplete="new-password"
            disabled={isSubmitting}
            error={fieldErrors.password}
            onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
          />

          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('invite.accepting') : t('invite.accept')}
          </Button>
        </form>

        <GoogleSignInSection
          disabled={isSubmitting}
          onSuccess={credential => handleGoogleAccept(state.invitation, credential)}
          onError={() => { resetFieldErrors(); setFormErrorKey('errors.api.invalidGoogleToken') }}
          hint={t('invite.googleEmailHint', { email: state.invitation.invite_email })}
        />
      </AuthMessageLayout>
    )
  }

  if (state.status === 'wrong_account') {
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        icon="⚠️"
        title={t('invite.title')}
        titleSize="md"
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('invite.wrongAccount', {
            email: state.loggedInEmail,
            inviteEmail: state.invitation.invite_email,
          })}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            logout()
            if (state.invitation.status === 'pending') {
              setState({ status: 'form', invitation: state.invitation })
            } else {
              navigate(acceptInvitePath(state.invitation.token))
            }
          }}
        >
          {t('nav.logout')}
        </Button>
      </AuthMessageLayout>
    )
  }

  if (state.status === 'accepting') {
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        title={t('invite.accepting')}
        statusMessage={t('invite.accepting')}
      />
    )
  }

  if (state.status === 'success') {
    const loggedInParent = isAuthenticated && currentUser?.role === 'parent'
    return (
      <AuthMessageLayout
        headingId="invite-heading"
        icon="🎉"
        title={t('invite.successTitle')}
        statusMessage={t('invite.successTitle')}
      >
        <p className="font-body text-sm text-gray-700 text-center w-full">
          {t('invite.successHint', { name: state.kidName })}
        </p>
        <Button
          variant="primary"
          onClick={() => navigate(loggedInParent ? '/parent/dashboard' : '/login')}
        >
          {loggedInParent ? t('invite.goToDashboard') : t('auth.login')}
        </Button>
      </AuthMessageLayout>
    )
  }

  return null
}
