import client from './client'

// ─── JWT helpers ────────────────────────────────────────────────────────────

// A JWT is three base64 strings joined by dots: header.payload.signature
// We only care about the payload, which contains user info the backend put there.
// We don't verify the signature on the frontend — the backend does that.
export function decodeJWT(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    // atob() decodes base64 → string, then we parse the JSON
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

export { parseApiError } from './errors'

// ─── API response types ──────────────────────────────────────────────────────

interface TokenResponse {
  access: string
  refresh: string
}

export interface KidSignupResponse {
  kid_id: string
  username: string
  name: string
  registration_status: 'awaiting_primary_parent' | 'active' | 'suspended'
  message: string
}

// ─── Auth endpoints ──────────────────────────────────────────────────────────

// POST /auth/token/  — parent login with email + password
export async function loginParent(email: string, password: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/token/', { email, password })
  return res.data
}

// POST /auth/kid/token/  — kid login with username + password
export async function loginKid(username: string, password: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/kid/token/', { username, password })
  return res.data
}

// POST /auth/register/  — parent account creation
// Returns user info but NOT tokens (we'll call loginParent right after to auto-login)
export async function registerParent(email: string, username: string, password: string) {
  const res = await client.post('/auth/register/', { email, username, password })
  return res.data
}

// GET /guardian-invitations/{token}/  — fetch invite details before accepting
export interface InvitationDetails {
  token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
  role: 'primary' | 'secondary'
  invite_email: string
  invited_username_hint: string
  expires_at: string
  kid_name: string
  kid_id: string
}

export async function getInvitation(token: string): Promise<InvitationDetails> {
  const res = await client.get<InvitationDetails>(`/guardian-invitations/${token}/`)
  return res.data
}

// POST /guardian-invitations/accept/  — parent accepts the invite (requires parent JWT)
export async function acceptInvitation(token: string) {
  const res = await client.post('/guardian-invitations/accept/', { token })
  return res.data
}

// POST /auth/token/verify/  — check if the stored access token is still valid
// Returns true if valid, false if expired or invalid
export async function verifyToken(token: string): Promise<boolean> {
  try {
    await client.post('/auth/token/verify/', { token })
    return true
  } catch {
    return false
  }
}

// POST /kids/invite-parent/  — kid invites a second guardian (requires kid JWT)
export async function inviteParent(parent_email: string, invited_username_hint?: string) {
  const res = await client.post('/kids/invite-parent/', {
    parent_email,
    ...(invited_username_hint ? { invited_username_hint } : {}),
  })
  return res.data
}

// POST /auth/google/  — parent sign-in / sign-up via Google Identity Services
// Send the id_token Google gives us; backend verifies it and returns JWT tokens
export async function loginWithGoogle(idToken: string): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/google/', { id_token: idToken })
  return res.data
}

// POST /kids/signup/  — kid registration
// Kid can't log in until a parent accepts the email invitation
export async function signupKid(
  name: string,
  username: string,
  password: string,
  parent_email: string,
): Promise<KidSignupResponse> {
  const res = await client.post<KidSignupResponse>('/kids/signup/', {
    name,
    username,
    password,
    parent_email,
  })
  return res.data
}
