import { useTranslation } from 'react-i18next'

/** Shown while Zustand auth state rehydrates from localStorage. */
export default function AuthHydrationFallback() {
  const { t } = useTranslation()

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-primary-50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{t('a11y.loadingSession')}</span>
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500"
        aria-hidden="true"
      />
    </div>
  )
}
