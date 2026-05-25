import type { ReactNode } from 'react'
import LanguageSwitcher from './LanguageSwitcher'

interface AuthMessageLayoutProps {
  headingId: string
  title: string
  icon?: string
  titleSize?: 'lg' | 'md'
  children?: ReactNode
  footer?: ReactNode
  /** Announced when the view updates (e.g. loading → success). */
  statusMessage?: string
  /** Error or detail text; rendered with role="alert", not as the page heading. */
  alertMessage?: string
}

export default function AuthMessageLayout({
  headingId,
  title,
  icon,
  titleSize = 'lg',
  children,
  footer,
  statusMessage,
  alertMessage,
}: AuthMessageLayoutProps) {
  const titleClass =
    titleSize === 'lg'
      ? 'font-heading text-3xl font-bold text-primary-700 text-center'
      : 'font-heading text-2xl font-bold text-primary-700 text-center'

  return (
    <main
      aria-labelledby={headingId}
      className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12"
    >
      {statusMessage && (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
      )}
      {icon && (
        <div className="text-5xl" aria-hidden="true">
          {icon}
        </div>
      )}
      <h1 id={headingId} className={titleClass}>
        {title}
      </h1>
      {alertMessage && (
        <p role="alert" className="font-body text-sm text-gray-700 text-center w-80 max-w-full">
          {alertMessage}
        </p>
      )}
      {children && (
        <div className="flex flex-col items-center gap-4 w-80 max-w-full">
          {children}
        </div>
      )}
      {footer}
      <LanguageSwitcher />
    </main>
  )
}
