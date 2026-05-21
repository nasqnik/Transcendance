import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import FormField from '../components/FormField'
import FormAlert from '../components/FormAlert'
import LanguageSwitcher from '../components/LanguageSwitcher'
import useAuthStore from '../store/authStore'
import {
  getInvitation,
  acceptInvitation,
  loginParent,
  registerParent,
  decodeJWT,
  parseApiError,
  type InvitationDetails,
} from '../api/auth'
import { isAccountNotFound } from '../api/errors'
import { isEmpty } from '../utils/validation'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'form'; invitation: InvitationDetails }
  | { status: 'wrong_account'; invitation: InvitationDetails; loggedInEmail: string }
  | { status: 'accepting' }
  | { status: 'success'; kidName: string }

export default function AcceptInvite() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, currentUser, login, logout } = useAuthStore()

  const [state, setState] = useState<PageState>({ status: 'loading' })

  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inviteToken = searchParams.get('token')

  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  // ── Load invitation on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!inviteToken) {
      setState({ status: 'error', message: t('invite.notFound') })
      return
    }

    getInvitation(inviteToken)
      .then(invitation => {
        if (invitation.status !== 'pending') {
          setState({ status: 'error', message: t('invite.notFound') })
          return
        }

        if (isAuthenticated && currentUser?.role === 'parent') {
          if (currentUser.email !== invitation.invite_email) {
            setState({ status: 'wrong_account', invitation, loggedInEmail: currentUser.email! })
          } else {
            doAccept(invitation)
          }
        } else {
          // Pre-fill username hint from invitation if provided
          if (invitation.invited_username_hint) {
            setUsername(invitation.invited_username_hint)
          }
          setState({ status: 'form', invitation })
        }
      })
      .catch(() => setState({ status: 'error', message: t('invite.notFound') }))
  }, [inviteToken])

  // ── Accept the invitation ─────────────────────────────────────────────────
  async function doAccept(invitation: InvitationDetails) {
    setState({ status: 'accepting' })
    try {
      await acceptInvitation(invitation.token)
      setState({ status: 'success', kidName: invitation.kid_name })
    } catch (err) {
      setState({ status: 'error', message: parseApiError(err) })
    }
  }

  // ── Form submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.status !== 'form') return

    setFormError(null)
    const errs: Record<string, string> = {}
    if (isEmpty(username)) errs.username = t('errors.required')
    if (isEmpty(password)) errs.password = t('errors.required')
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setIsSubmitting(true)

    const { invitation } = state

    try {
      // Try login first — works if the parent already has an account
      const { access, refresh } = await loginParent(invitation.invite_email, password)
      const payload = decodeJWT(access)
      login(
        { id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' },
        access,
        refresh,
      )
      await doAccept(invitation)

    } catch (err) {
      if (isAccountNotFound(err)) {
        // No account yet — register then login
        try {
          await registerParent(invitation.invite_email, username, password)
          const { access, refresh } = await loginParent(invitation.invite_email, password)
          const payload = decodeJWT(access)
          login(
            { id: payload.user_id as string, username: payload.username as string, email: payload.email as string, role: 'parent' },
            access,
            refresh,
          )
          await doAccept(invitation)
        } catch (registerErr) {
          setFormError(parseApiError(registerErr))
        }
      } else {
        setFormError(parseApiError(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main aria-labelledby="invite-heading" className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12">

      {state.status === 'loading' && (
        <p className="font-body text-gray-600">{t('invite.loading')}</p>
      )}

      {state.status === 'error' && (
        <>
          <div className="text-5xl" aria-hidden="true">❌</div>
          <h1 id="invite-heading" className="font-heading text-2xl font-bold text-primary-700 text-center">
            {state.message}
          </h1>
          <Button variant="secondary" onClick={() => navigate('/')}>
            {t('auth.backToHome')}
          </Button>
        </>
      )}

      {state.status === 'form' && (
        <>
          <div className="text-5xl" aria-hidden="true">👋</div>
          <h1 id="invite-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
            {t('invite.title')}
          </h1>
          <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
            {t('invite.subtitle', { name: state.invitation.kid_name })}
          </p>
          <p className="font-body text-xs text-gray-500 text-center">
            {t('invite.invitedAs', { email: state.invitation.invite_email })}
          </p>

          <form
            noValidate
            className="flex w-80 max-w-full flex-col gap-4"
            onSubmit={handleSubmit}
            aria-labelledby="invite-heading"
          >
            {formError && <FormAlert message={formError} />}

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
              id="password"
              label={t('auth.password')}
              type="password"
              value={password}
              required
              autoComplete="current-password"
              error={fieldErrors.password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
            />

            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('invite.accepting') : t('invite.accept')}
            </Button>
          </form>
        </>
      )}

      {state.status === 'wrong_account' && (
        <>
          <div className="text-5xl" aria-hidden="true">⚠️</div>
          <h1 id="invite-heading" className="font-heading text-2xl font-bold text-primary-700 text-center">
            {t('invite.title')}
          </h1>
          <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
            {t('invite.wrongAccount', {
              email: state.loggedInEmail,
              inviteEmail: state.invitation.invite_email,
            })}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              logout()
              setState({ status: 'form', invitation: state.invitation })
            }}
          >
            {t('nav.logout')}
          </Button>
        </>
      )}

      {state.status === 'accepting' && (
        <p className="font-body text-gray-600">{t('invite.accepting')}</p>
      )}

      {state.status === 'success' && (
        <>
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h1 id="invite-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
            {t('invite.successTitle')}
          </h1>
          <p className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
            {t('invite.successHint', { name: state.kidName })}
          </p>
          <Button variant="primary" onClick={() => navigate('/parent/dashboard')}>
            {t('invite.goToDashboard')}
          </Button>
        </>
      )}

      <LanguageSwitcher />
    </main>
  )
}
