import {
  loginParent,
  loginKid,
  loginWithGoogle,
  loginKidWithGoogle,
} from '../api/auth'
import {
  dualLoginErrorKey,
  getApiErrorKey,
  isEmailNotVerified,
  isKidNotActiveYet,
} from '../api/errors'
import { establishKidSession, establishParentSession } from './session'

export type LoginCredentials =
  | { type: 'password'; identifier: string; password: string }
  | { type: 'google'; credential: string }

export type DualLoginResult =
  | { status: 'success' }
  | { status: 'waiting_for_parent' }
  | { status: 'error'; errorKey: string }

type NavigateFn = (path: string) => void

/** Try parent login, then kid — shared by password and Google on the login page. */
export async function attemptDualRoleLogin(
  credentials: LoginCredentials,
  navigate?: NavigateFn,
): Promise<DualLoginResult> {
  try {
    const parentTokens =
      credentials.type === 'password'
        ? await loginParent(credentials.identifier, credentials.password)
        : await loginWithGoogle(credentials.credential)
    establishParentSession(parentTokens, navigate)
    return { status: 'success' }
  } catch (parentErr) {
    if (isEmailNotVerified(parentErr)) {
      return { status: 'error', errorKey: getApiErrorKey(parentErr) }
    }

    try {
      const kidTokens =
        credentials.type === 'password'
          ? await loginKid(credentials.identifier, credentials.password)
          : await loginKidWithGoogle(credentials.credential)
      establishKidSession(kidTokens, navigate)
      return { status: 'success' }
    } catch (kidErr) {
      if (isKidNotActiveYet(kidErr)) {
        return { status: 'waiting_for_parent' }
      }
      return { status: 'error', errorKey: dualLoginErrorKey(parentErr, kidErr) }
    }
  }
}
