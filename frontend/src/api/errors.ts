import i18n from '../i18n/config'

/** Exact backend message → i18n key under `errors.api.*` */
const API_ERROR_KEYS: Record<string, string> = {
  'No active account found with the given credentials.': 'errors.api.invalidCredentials',
  'No active account found with the given credentials': 'errors.api.invalidCredentials',
  'No active kid account found with the given credentials.': 'errors.api.invalidKidCredentials',
  'Kid account is not active yet.': 'errors.api.kidNotActiveYet',
  'Kid account is not active.': 'errors.api.kidNotActive',
  'user with this email already exists.': 'errors.api.emailExists',
  'A user with this email already exists.': 'errors.api.emailExists',
  'A user with that username already exists.': 'errors.api.usernameExists',
  'This username is already taken.': 'errors.api.usernameTaken',
  'Invitation not found.': 'errors.api.invitationNotFound',
  'Invitation has expired.': 'errors.api.invitationExpired',
  'Your account email does not match the invitation email.': 'errors.api.invitationEmailMismatch',
  'This account is inactive.': 'errors.api.accountInactive',
  'Invalid refresh token.': 'errors.api.invalidRefreshToken',
  'Not a kid refresh token.': 'errors.api.notKidRefreshToken',
  'Kid not found.': 'errors.api.kidNotFound',
  'This kid already has the maximum number of guardians.': 'errors.api.maxGuardians',
  'Given token not valid for any token type': 'errors.api.tokenNotValid',
  'Google sign-in is not configured on the server.': 'errors.api.googleNotConfigured',
  'Invalid Google token.': 'errors.api.invalidGoogleToken',
  'Invalid Google token issuer.': 'errors.api.invalidGoogleIssuer',
  'Google email is not verified.': 'errors.api.googleEmailNotVerified',
  'Google account has no email.': 'errors.api.googleNoEmail',
  'This email is linked to a different Google account.': 'errors.api.googleAccountConflict',
}

function translateServerMessage(message: string): string {
  const trimmed = message.trim()
  const key = API_ERROR_KEYS[trimmed]
  if (key) return i18n.t(key)

  if (trimmed.startsWith('Invitation is not pending')) {
    return i18n.t('errors.api.invitationNotPending')
  }

  // Unknown server text — avoid mixing English into AR/RU UI
  return i18n.t('errors.apiUnknown')
}

function genericError(): string {
  return i18n.t('errors.generic')
}

/**
 * Returns true if the error means "no account with this email exists".
 * Used on the accept-invite page to auto-switch to signup.
 */
export function isAccountNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { response?: { data?: unknown } }
  const data = err.response?.data
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  const detail = typeof obj.detail === 'string' ? obj.detail.trim() : ''
  return (
    detail === 'No active account found with the given credentials.' ||
    detail === 'No active account found with the given credentials'
  )
}

/**
 * Turn axios/DRF errors into a localized string.
 * Known backend messages are mapped to `errors.api.*`; others use `errors.apiUnknown`.
 */
export function parseApiError(error: unknown): string {
  if (!error || typeof error !== 'object') return genericError()

  const err = error as { response?: { data?: unknown } }
  const data = err.response?.data

  if (!data || typeof data !== 'object') return genericError()

  const obj = data as Record<string, unknown>

  if (typeof obj.detail === 'string') return translateServerMessage(obj.detail)

  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return translateServerMessage(value[0])
    }
    if (typeof value === 'string') return translateServerMessage(value)
  }

  return genericError()
}
