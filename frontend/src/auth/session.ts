import { decodeJWT } from '../api/auth'
import useAuthStore, { type User } from '../store/authStore'

export const PARENT_DASHBOARD_PATH = '/parent/dashboard'
export const KID_DASHBOARD_PATH = '/dashboard'

export function dashboardPathForRole(role?: User['role']): string {
  return role === 'parent' ? PARENT_DASHBOARD_PATH : KID_DASHBOARD_PATH
}

export interface TokenPair {
  access: string
  refresh: string
}

type NavigateFn = (path: string) => void

export function parentUserFromAccessToken(access: string): User {
  const payload = decodeJWT(access)
  return {
    id: payload.user_id as string,
    username: payload.username as string,
    email: payload.email as string,
    role: 'parent',
  }
}

export function kidUserFromAccessToken(access: string): User {
  const payload = decodeJWT(access)
  return {
    id: payload.kid_id as string,
    username: payload.username as string,
    email: (payload.email as string) ?? undefined,
    role: 'kid',
  }
}

/** Decode parent JWT, persist session. Optionally redirect to parent dashboard. */
export function establishParentSession(
  { access, refresh }: TokenPair,
  navigate?: NavigateFn,
): User {
  const user = parentUserFromAccessToken(access)
  useAuthStore.getState().login(user, access, refresh)
  if (navigate) navigate(PARENT_DASHBOARD_PATH)
  return user
}

/** Decode kid JWT, persist session. Optionally redirect to kid dashboard. */
export function establishKidSession(
  { access, refresh }: TokenPair,
  navigate?: NavigateFn,
): User {
  const user = kidUserFromAccessToken(access)
  useAuthStore.getState().login(user, access, refresh)
  if (navigate) navigate(KID_DASHBOARD_PATH)
  return user
}
