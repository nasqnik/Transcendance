/** Matches Django `MinimumLengthValidator` default and serializer `min_length=8`. */
export const PASSWORD_MIN_LENGTH = 8

export function isEmpty(value: string): boolean {
  return !value.trim()
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Case-insensitive email comparison (matches backend invite accept rules). */
export function emailsMatchIgnoreCase(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export interface PasswordValidationContext {
  username?: string
  email?: string
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string

/** Client-side checks aligned with Django `AUTH_PASSWORD_VALIDATORS` (backend/users). */
export function validatePasswordField(
  password: string,
  t: TranslateFn,
  context?: PasswordValidationContext,
): string | undefined {
  if (isEmpty(password)) return t('errors.required')

  if (password.length < PASSWORD_MIN_LENGTH) {
    return t('errors.passwordMinLength', { min: PASSWORD_MIN_LENGTH })
  }

  if (/^\d+$/.test(password)) {
    return t('errors.passwordEntirelyNumeric')
  }

  const pw = password.toLowerCase()
  const username = context?.username?.trim().toLowerCase()
  if (username && pw === username) {
    return t('errors.passwordTooSimilar')
  }

  const email = context?.email?.trim().toLowerCase()
  if (email) {
    const localPart = email.split('@')[0]
    if (pw === email || (localPart.length > 0 && pw === localPart)) {
      return t('errors.passwordTooSimilar')
    }
  }

  return undefined
}
