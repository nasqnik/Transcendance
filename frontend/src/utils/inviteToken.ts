const STORAGE_KEY = 'pendingInviteToken'

export function savePendingInviteToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token)
}

export function getPendingInviteToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function clearPendingInviteToken() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function acceptInvitePath(token: string): string {
  return `/accept-invite?token=${encodeURIComponent(token)}`
}
