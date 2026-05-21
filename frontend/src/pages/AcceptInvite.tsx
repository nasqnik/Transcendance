import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import Input from '../components/Input'
import LanguageSwitcher from '../components/LanguageSwitcher'
import useAuthStore from '../store/authStore'
import {
  getInvitation,
  acceptInvitation,
  loginParent,
  decodeJWT,
  parseApiError,
  type InvitationDetails,
} from '../api/auth'

// This page handles the link parents receive in their email:
//   https://localhost/accept-invite?token=<uuid>
//
// Flow:
//   1. Read token from URL → fetch invite details from backend
//   2. If parent is already logged in → accept automatically
//   3. If not logged in → show login form → accept after login
//   4. Show success screen when done

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'login'; invitation: InvitationDetails }
  | { status: 'wrong_account'; invitation: InvitationDetails; loggedInEmail: string }
  | { status: 'accepting'; invitation: InvitationDetails }
  | { status: 'success'; kidName: string }

export default function AcceptInvite() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, currentUser, token: authToken, login } = useAuthStore()

  const [state, setState] = useState<PageState>({ status: 'loading' })

  // Login form state (shown when parent isn't logged in yet)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inviteToken = searchParams.get('token')

  // ── Step 1: load the invitation on mount ──────────────────────────────────
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
          // Parent is already logged in — check if it's the right account
          if (currentUser.email !== invitation.invite_email) {
            setState({ status: 'wrong_account', invitation, loggedInEmail: currentUser.email! })
          } else {
            // Right account — auto-accept
            doAccept(invitation)
          }
        } else {
          // Not logged in — show login form
          setState({ status: 'login', invitation })
        }
      })
      .catch(() => setState({ status: 'error', message: t('invite.notFound') }))
  }, [inviteToken])

  // ── Step 2: call the accept endpoint ─────────────────────────────────────
  async function doAccept(invitation: InvitationDetails) {
    setState({ status: 'accepting', invitation })
    try {
      await acceptInvitation(invitation.token)
      setState({ status: 'success', kidName: invitation.kid_name })
    } catch (err) {
      setState({ status: 'error', message: parseApiError(err) })
    }
  }

  // ── Step 3: login form submit ─────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (state.status !== 'login') return

    setFormError(null)
    setIsSubmitting(true)

    try {
      const { access, refresh } = await loginParent(email, password)
      const payload = decodeJWT(access)

      // Check that the logged-in email matches the invite
      if (payload.email !== state.invitation.invite_email) {
        setFormError(
          t('invite.wrongAccount', {
            email: payload.email,
            inviteEmail: state.invitation.invite_email,
          })
        )
        setIsSubmitting(false)
        return
      }

      // Store in auth store then accept
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

      await doAccept(state.invitation)
    } catch (err) {
      setFormError(parseApiError(err))
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

      {state.status === 'login' && (
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

          <p className="font-body text-sm font-semibold text-gray-700">
            {t('invite.loginToAccept')}
          </p>

          <form
            className="flex w-80 max-w-full flex-col gap-4"
            onSubmit={handleLogin}
            aria-labelledby="invite-heading"
          >
            {formError && (
              <p role="alert" className="font-body text-sm text-red-600 text-center bg-red-50 rounded-xl px-4 py-3">
                {formError}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="font-body text-sm font-semibold text-gray-700">
                {t('auth.email')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                placeholder={t('auth.emailHint')}
                required
                autoComplete="email"
                onChange={e => setEmail(e.target.value)}
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
            </div>
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
