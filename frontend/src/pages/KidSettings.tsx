import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type TaskCategory, CATEGORY_STYLE } from '../constants/categories'
import { getCategorySettings, updateCategorySettings, type CategorySettings } from '../api/tasks'
import { inviteParent } from '../api/auth'
import { getApiErrorKey } from '../api/errors'
import { useFormErrors } from '../hooks/useFormErrors'
import { isValidEmail, isEmpty } from '../utils/validation'
import FormField from '../components/FormField'
import FormAlert from '../components/FormAlert'
import Button from '../components/Button'
import { usePageTitle } from '../hooks/usePageTitle'

// ─── Category → settings key map ─────────────────────────────────────────────

const ROWS: Array<{ category: TaskCategory; key: keyof CategorySettings }> = [
  { category: 'health',         key: 'show_health'         },
  { category: 'learning',       key: 'show_learning'       },
  { category: 'responsibility', key: 'show_responsibility' },
  { category: 'creativity',     key: 'show_creativity'     },
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring disabled:opacity-50 ${
        checked ? 'bg-primary-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KidSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  usePageTitle(t('kidDash.settings'))

  const { data: serverSettings } = useQuery({
    queryKey: ['categorySettings'],
    queryFn: getCategorySettings,
  })

  // Local state mirrors server — updated optimistically on each toggle
  const [settings, setSettings] = useState<CategorySettings | null>(null)
  const [savedRecently, setSavedRecently] = useState(false)

  // Sync local state once server data arrives
  useEffect(() => {
    if (serverSettings && !settings) setSettings(serverSettings)
  }, [serverSettings, settings])

  // ── Invite parent ────────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail]       = useState('')
  const [usernameHint, setUsernameHint]     = useState('')
  const [inviteErrorKey, setInviteErrorKey] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [sentTo, setSentTo]                 = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteErrorKey(null)
    const errs: Record<string, string> = {}
    if (isEmpty(inviteEmail))            errs.email = t('errors.required')
    else if (!isValidEmail(inviteEmail)) errs.email = t('errors.invalidEmail')
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    resetFieldErrors()
    setInviteLoading(true)
    try {
      await inviteParent(inviteEmail, usernameHint || undefined)
      setSentTo(inviteEmail)
      setInviteEmail('')
      setUsernameHint('')
    } catch (err) {
      setInviteErrorKey(getApiErrorKey(err))
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Category visibility ───────────────────────────────────────────────────────
  const { mutate: save, isPending, isError } = useMutation({
    mutationFn: updateCategorySettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['categorySettings'], updated)
      setSavedRecently(true)
      setTimeout(() => setSavedRecently(false), 2000)
    },
    onError: () => {
      // Revert to last known server state on failure
      if (serverSettings) setSettings(serverSettings)
    },
  })

  function handleToggle(key: keyof CategorySettings, value: boolean) {
    if (!settings) return
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    save(updated)
  }

  const displaySettings = settings ?? serverSettings

  return (
    <main
      aria-labelledby="settings-heading"
      className="flex-1 p-6 max-w-lg overflow-auto"
    >
      <h1
        id="settings-heading"
        className="font-heading text-2xl font-bold text-gray-900 mb-6"
      >
        {t('kidDash.settings')}
      </h1>

      <section className="bg-white rounded-2xl p-6">

        {/* Section header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-base font-bold text-gray-900">
            {t('kidDash.categoryVisibility')}
          </h2>
          <span className="font-body text-xs text-gray-400 h-4">
            {isPending    && t('tasks.creating').replace('...', '…')}
            {savedRecently && !isPending && '✓'}
          </span>
        </div>
        <p className="font-body text-sm text-gray-400 mb-5">
          {t('kidDash.categoryVisibilityHint')}
        </p>

        {/* Toggle rows */}
        {!displaySettings ? (
          <p className="font-body text-sm text-gray-400">{t('tasks.loading')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {ROWS.map(({ category, key }) => {
              const style = CATEGORY_STYLE[category]
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center text-base shrink-0`} aria-hidden="true">
                      {style.icon}
                    </div>
                    <span className="font-body text-sm font-semibold text-gray-700">
                      {t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)}
                    </span>
                  </div>
                  <Toggle
                    checked={displaySettings[key]}
                    onChange={value => handleToggle(key, value)}
                    disabled={isPending}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p role="alert" className="font-body text-sm text-danger-500 mt-4">
            {t('errors.generic')}
          </p>
        )}

      </section>

      {/* Invite a parent */}
      <section className="bg-white rounded-2xl p-6 mt-4">
        <h2 className="font-heading text-base font-bold text-gray-900 mb-1">
          {t('inviteParent.title')}
        </h2>
        <p className="font-body text-sm text-gray-400 mb-5">
          {t('inviteParent.hint')}
        </p>

        {sentTo ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="text-3xl" aria-hidden="true">📬</div>
            <p className="font-body text-sm font-semibold text-primary-700">
              {t('inviteParent.success', { email: sentTo })}
            </p>
            <p className="font-body text-xs text-gray-500">{t('inviteParent.successHint')}</p>
            <Button variant="secondary" onClick={() => setSentTo(null)}>
              {t('inviteParent.sendAnother')}
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleInvite}
            className="flex flex-col gap-3"
            aria-label={t('inviteParent.title')}
            aria-busy={inviteLoading}
          >
            {inviteErrorKey && <FormAlert message={t(inviteErrorKey)} />}
            <FormField
              id="invite-email"
              label={t('inviteParent.email')}
              type="email"
              value={inviteEmail}
              required
              autoComplete="off"
              disabled={inviteLoading}
              error={fieldErrors.email}
              onChange={e => { setInviteEmail(e.target.value); clearFieldError('email') }}
            />
            <FormField
              id="invite-username-hint"
              label={t('inviteParent.usernameHint')}
              type="text"
              dir="ltr"
              value={usernameHint}
              autoComplete="off"
              disabled={inviteLoading}
              onChange={e => setUsernameHint(e.target.value)}
            />
            <Button variant="primary" type="submit" disabled={inviteLoading}>
              {inviteLoading ? t('inviteParent.sending') : t('inviteParent.submit')}
            </Button>
          </form>
        )}
      </section>

    </main>
  )
}
