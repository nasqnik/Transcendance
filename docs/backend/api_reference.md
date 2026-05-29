# KiddoPath — Backend API (frontend integration)

Document for connecting the React app to the Django backend.

**App name:** `KiddoPath` (configurable via backend `APP_NAME` env var).

---

## Base URL & headers

### Production-like dev (recommended — via nginx)

```text
https://localhost/api/
```

All API paths below are relative to this base, e.g. `POST https://localhost/api/kids/signup/`.

The browser may need to trust the local self-signed cert (or use `-k` in curl).

### Direct auth-service (optional, debugging only)

```text
http://localhost:8001/api/
```

### Required headers

```http
Content-Type: application/json
```

For authenticated routes:

```http
Authorization: Bearer <access_token>
```

Use the **`access`** token from login responses, **not** `refresh`.

---

## Authentication overview

Two separate JWT stacks:

| Actor | Login endpoint | Token claims (access) | Use on |
|--------|----------------|------------------------|--------|
| **Parent** | `POST /auth/token/` or `POST /auth/google/` | `role: "parent"`, `user_id`, `email`, `username` | Parent routes (e.g. accept invite) |
| **Kid** | `POST /auth/kid/token/` or `POST /auth/kid/google/` | `role: "kid"`, `kid_id`, `username` | Kid routes (e.g. invite second parent) |

**Refresh:**

| Actor | Endpoint |
|--------|----------|
| Parent | `POST /auth/token/refresh/` |
| Kid | `POST /auth/kid/token/refresh/` |

**Verify (optional):** `POST /auth/token/verify/` with `{ "token": "<access>" }`.

**Email verification (password signup):** required before login. Google sign-in sets `email_verified` automatically.

Default access token lifetime: **60 minutes**. Refresh: **7 days**. Email verification links: **24 hours** (env-configurable).

---

## Domain enums (for UI state)

### Kid `registration_status`

| Value | Meaning |
|--------|---------|
| `awaiting_primary_parent` | Kid signed up; primary guardian has not accepted yet |
| `active` | Primary guardian accepted; kid can log in |
| `suspended` | Blocked (reserved for future use) |

### Guardian invitation `status`

| Value | Meaning |
|--------|---------|
| `pending` | Waiting for parent action |
| `accepted` | Parent linked |
| `declined` | Declined (reserved) |
| `expired` | Past `expires_at` |
| `revoked` | Cancelled (reserved) |

### Guardian invitation `role`

| Value | Meaning |
|--------|---------|
| `primary` | First parent from kid signup |
| `secondary` | Invited by kid after active |

---

## Endpoints summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/kids/signup/` | Public | Kid registration (email + password) + verify email + invite parent |
| `POST` | `/kids/signup/google/` | Public | Kid registration via Google + invite parent |
| `POST` | `/auth/kid/verify-email/` | Public | Confirm kid email (password signup) |
| `POST` | `/auth/kid/google/` | Public | Kid Google login (must be `active`) |
| `POST` | `/auth/register/` | Public | Parent account creation (sends verify email) |
| `POST` | `/auth/verify-email/` | Public | Confirm parent email (password signup) |
| `POST` | `/auth/token/` | Public | Parent login → JWT (requires `email_verified`) |
| `POST` | `/auth/token/refresh/` | Public | Refresh parent JWT |
| `POST` | `/auth/token/verify/` | Public | Validate parent access token |
| `GET` | `/guardian-invitations/{token}/` | Public | Invitation details (parent accept screen) |
| `POST` | `/guardian-invitations/accept/` | Parent JWT | Accept invitation |
| `POST` | `/auth/google/` | Public | Parent Google login → JWT |
| `POST` | `/auth/kid/token/` | Public | Kid login → JWT (`email_verified` + `active`) |
| `POST` | `/auth/kid/token/refresh/` | Public | Refresh kid JWT |
| `POST` | `/kids/invite-parent/` | Kid JWT | Invite second guardian |

---

## User flows (what to build)

### Flow A — Kid signup

```text
1. POST /kids/signup/  (includes kid email)  OR  POST /kids/signup/google/
2. Password path: kid verifies email via /kid/verify-email?token=...
3. Show UI: "Waiting for parent" (registration_status: awaiting_primary_parent)
4. Parent receives email (see Flow B)
```

### Flow B — Parent accepts (primary)

```text
1. Parent clicks email link → `https://localhost/accept-invite?token=<uuid>`
2. Frontend reads `token` from URL → `GET /guardian-invitations/{token}/`
3. If no account: POST /auth/register/  (email must match invite_email)
4. Password path: verify email → POST /auth/verify-email/
5. POST /auth/token/  OR  POST /auth/google/  → store access + refresh
6. POST /guardian-invitations/accept/  with { "token": "<uuid>" } + Bearer parent access
7. Kid becomes active; parent is linked
```

**Rules:**

- Logged-in parent **email must match** `invite_email` on the invitation.
- Accept only works when invitation `status` is `pending` and not expired.

### Flow C — Kid login (after parent accepted)

```text
1. POST /auth/kid/token/  OR  POST /auth/kid/google/
2. Requires email_verified (password path) and registration_status active
3. Store kid access + refresh
4. Use kid access for kid-only APIs
```

### Flow D — Invite second parent

```text
1. Kid logged in (kid JWT)
2. POST /kids/invite-parent/  { parent_email, invited_username_hint? }
3. Second parent: same as Flow B (register/login → accept with new token)
```

Max **2** accepted guardians per kid.

---

## Endpoint details

### `POST /kids/signup/`

**Auth:** none

**Request body:**

```json
{
  "name": "Alex",
  "username": "alex_kid",
  "email": "alex@example.com",
  "password": "secure-pass-1",
  "parent_email": "parent@example.com"
}
```

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Display name |
| `username` | string | Unique, kid login id |
| `email` | string | Kid's email (unique); verification required before login |
| `password` | string | Min 8 chars, Django validators |
| `parent_email` | string | Primary guardian invite target |

**Success `201`:**

```json
{
  "kid_id": "uuid",
  "username": "alex_kid",
  "email": "alex@example.com",
  "name": "Alex",
  "registration_status": "awaiting_primary_parent",
  "email_verified": false,
  "message": "Check your email to verify your account. Waiting for parent response."
}
```

**Extra fields when backend `DEBUG=true` only:**

```json
{
  "invite_url": "https://localhost/accept-invite?token=uuid",
  "invite_token": "uuid",
  "verify_url": "https://localhost/kid/verify-email?token=uuid"
}
```

**Errors `400`:** field validation, e.g. `{ "username": ["This username is already taken."] }`

**Side effects:** sends kid verify email + guardian invite email to `parent_email`.

---

### `POST /auth/register/`

**Auth:** none

**Request body:**

```json
{
  "email": "parent@example.com",
  "username": "parent1",
  "password": "secure-pass-1"
}
```

**Success `201`:**

```json
{
  "user_id": "uuid",
  "email": "parent@example.com",
  "username": "parent1",
  "role": "parent",
  "email_verified": false,
  "message": "Check your email to verify your account."
}
```

**DEBUG only:** may include `verify_url` (`https://localhost/verify-email?token=uuid`).

**Side effect:** sends parent verify email. Login blocked until verified.

**Errors `400`:** e.g. `{ "email": ["user with this email already exists."] }`

---

### `POST /auth/verify-email/`

**Auth:** none · **Body:** `{ "token": "uuid" }` from `/verify-email?token=...`

**Success `200`:** `{ "email": "...", "email_verified": true, "message": "Email verified successfully." }`

---

### `POST /auth/kid/verify-email/`

**Auth:** none · **Body:** `{ "token": "uuid" }` from `/kid/verify-email?token=...`

**Success `200`:** `{ "kid_id": "uuid", "email_verified": true, "registration_status": "...", "message": "..." }`

---

### `POST /kids/signup/google/`

**Auth:** none · **Body:** `{ "id_token", "name", "username", "parent_email" }`

Creates kid with `email_verified=true` (Google). Sends guardian invite only (no verify email).

---

### `POST /auth/kid/google/`

**Auth:** none · **Body:** `{ "id_token" }` · Kid must be `active`.

**Success `200`:** `{ "access", "refresh" }` (kid JWT)

---

### `POST /auth/token/` (parent login)

**Auth:** none

**Request body:**

```json
{
  "emailOrUsername": "parent@example.com",
  "password": "secure-pass-1"
}
```

`emailOrUsername` accepts the parent's **email** or **username**.

**Success `200`:**

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors `401`:**

```json
{
  "detail": "No active account found with the given credentials"
}
```

Or `"Please verify your email before logging in."` if password is correct but account not verified.

---

### `POST /auth/token/refresh/`

**Request body:**

```json
{
  "refresh": "<parent_refresh_token>"
}
```

**Success `200`:** new `access` and `refresh` (rotation enabled on backend).

---

### `POST /auth/token/verify/`

**Request body:**

```json
{
  "token": "<parent_access_token>"
}
```

**Success `200`:** `{}`  
**Error `401`:** invalid/expired token

---

### `GET /guardian-invitations/{token}/`

**Auth:** none  
**URL param:** `token` — UUID from invitation email / DEBUG signup response

**Success `200`:**

```json
{
  "token": "uuid",
  "status": "pending",
  "role": "primary",
  "invite_email": "parent@example.com",
  "expires_at": "2026-05-27T12:00:00.000000Z",
  "kid_name": "Alex",
  "kid_id": "uuid"
}
```

**Error `404`:** `{ "detail": "Invitation not found." }`

Pending invites past `expires_at` are auto-updated to `status: "expired"`.

---

### `POST /guardian-invitations/accept/`

**Auth:** parent JWT (`Authorization: Bearer <access>`)

**Request body:**

```json
{
  "token": "uuid"
}
```

**Success `200`:**

```json
{
  "invitation_id": "uuid",
  "status": "accepted",
  "role": "primary",
  "kid_id": "uuid",
  "kid_name": "Alex",
  "kid_username": "alex_kid",
  "registration_status": "active",
  "message": "Guardian invitation accepted."
}
```

For **`role: "primary"`**, `registration_status` becomes `active` and kid can log in.  
For **`role: "secondary"`**, kid was already active; response shape is the same but `registration_status` stays `active`.

**Errors:**

| Code | Example |
|------|---------|
| `401` | Missing/invalid parent JWT |
| `400` | `{ "token": ["Invitation has expired."] }` |
| `400` | `{ "non_field_errors": ["Your account email does not match the invitation email."] }` |

---

### `POST /auth/kid/token/` (kid login)

**Auth:** none

**Request body:**

```json
{
  "emailOrUsername": "alex_kid",
  "password": "secure-pass-1"
}
```

`emailOrUsername` accepts the kid's **username** or **email**.

**Success `200`:**

```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

Access token includes `"role": "kid"` and `"kid_id"`.

**Errors `401`:** wrong credentials or kid not `active` yet

---

### `POST /auth/kid/token/refresh/`

**Request body:**

```json
{
  "refresh": "<kid_refresh_token>"
}
```

Must be a kid refresh token (`role: "kid"` in payload).

**Success `200`:** `{ "access": "...", "refresh": "..." }`

---

### `POST /kids/invite-parent/`

**Auth:** kid JWT

**Request body:**

```json
{
  "parent_email": "second@example.com",
  "invited_username_hint": "mom"
}
```

`invited_username_hint` is optional (max 150 chars).

**Success `201`:**

```json
{
  "invitation_id": "uuid",
  "invite_email": "second@example.com",
  "role": "secondary",
  "status": "pending",
  "message": "Second parent invitation sent."
}
```

**DEBUG only:** also returns `invite_url` and you can rely on email for `invite_token`.

**Errors `400`:** max guardians reached, kid not active, duplicate pending invite

**Errors `401`:** missing/invalid kid JWT

---

## Guardian invitation email (for UX copy)

When a kid signs up or invites a parent, the backend emails `parent_email` with:

- Link to **`{FRONTEND_URL}/accept-invite?token={uuid}`** — frontend reads `token` and calls `GET /guardian-invitations/{token}/`
- **Invitation code** (`invite_token` UUID) — parent enters this in your UI, then you call `GET /guardian-invitations/{token}/` and accept flow
- Instruction to register/login with the **same email** as `invite_email`

Frontend should implement a screen like: **“Enter invitation code”** or deep-link `?invite=<uuid>` that you parse and pass to the API.

---

## Error response format (DRF)

Validation errors (`400`):

```json
{
  "field_name": ["Error message."]
}
```

Or non-field:

```json
{
  "token": ["Invitation has expired."]
}
```

Authentication (`401`):

```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid"
}
```

Not found (`404`):

```json
{
  "detail": "Invitation not found."
}
```

---

## Frontend implementation checklist

- [ ] API base URL: `https://localhost/api` (or env `VITE_API_URL`)
- [ ] Store parent vs kid tokens separately (or tag by decoded `role`)
- [ ] Attach `Authorization: Bearer <access>` on protected calls
- [ ] Refresh access token before expiry using the correct refresh endpoint
- [ ] Kid signup → waiting-for-parent screen
- [ ] Parent: invitation code input → preview → register/login → accept
- [ ] Kid login only after `registration_status === active`
- [ ] Second parent invite from kid-authenticated screen
- [ ] Parent Google sign-in (see below)

---

## Google sign-in (parents only) — chosen approach

**Decision:** use **Google Identity Services (GIS)** — **credential / `id_token` flow**, **not** a full OAuth redirect callback.

**Who:** parents/guardians only (`CustomUser`). **Kids do not use Google.**

### Why this flow

| Approach | Verdict |
|----------|---------|
| **GIS button → send `id_token` to API** | **Use this** — fits SPA + JWT; same login result as email/password |
| OAuth redirect (`/auth/google/callback`) | Skip — extra routes, state, and redirect URI handling |

### Google Cloud Console (Web client)

**Authorized JavaScript origins:**

```text
https://localhost
```

Add `http://localhost:5173` only if the team tests Vite without nginx.

**Authorized redirect URIs:** leave **empty** for GIS credential flow (no redirect needed).

Share the **Client ID** with frontend (public). Backend keeps the same ID in `GOOGLE_OAUTH_CLIENT_ID` to verify tokens.

### Frontend package (recommended)

[`@react-oauth/google`](https://www.npmjs.com/package/@react-oauth/google)

```tsx
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <GoogleLogin
    onSuccess={async (response) => {
      // response.credential is the Google id_token (JWT string)
      await loginWithGoogle(response.credential);
    }}
    onError={() => { /* show error */ }}
  />
</GoogleOAuthProvider>
```

Env:

```env
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

App must be served from an **authorized origin** (e.g. `https://localhost` via nginx).

### API contract

**`POST /api/auth/google/`** · **Public**

**Request:**

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

(`id_token` is the string from `response.credential` — Google’s JWT, not your app JWT.)

**Success `200`:** same as parent password login:

```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

**Backend env:** `GOOGLE_CLIENT_ID` must match the frontend Web client ID.

**User linking:** if a parent already registered with the same email, Google login attaches `google_sub` to that account.

**Errors `400`:** invalid token, unverified email, email linked to another Google account, Google not configured.

**Example:**

```javascript
async function loginWithGoogle(idToken) {
  const res = await fetch('/api/auth/google/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw await res.json();
  return res.json(); // { access, refresh }
}
```

### Guardian invite + Google

When accepting an invite with Google:

1. `GET /guardian-invitations/{token}/` → read `invite_email`
2. Google login → `POST /auth/google/`
3. Backend must ensure Google **verified email** matches `invite_email`
4. `POST /guardian-invitations/accept/` with parent `access` + `{ "token": "..." }`

Frontend: on the accept screen, show which email the invite expects; warn if Google account email differs.

### UX placement

- Parent **login** and **register** screens: “Continue with Google”
- Parent **accept invitation** screen: Google option **after** showing `invite_email`
- **Not** on kid signup/login

---

## Not implemented yet (backend)

- Optional: `GOOGLE_CLIENT_SECRET` (only needed for OAuth redirect flow, not current GIS flow)
- Parent password reset API
- Resend / cancel invitation
- CORS (not needed if all requests go through nginx same-origin `https://localhost`)

---

## Example fetch (parent accept)

```javascript
const API = '/api';

async function acceptInvite(accessToken, inviteToken) {
  const res = await fetch(`${API}/guardian-invitations/accept/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token: inviteToken }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

```javascript
async function parentLogin(emailOrUsername, password) {
  const res = await fetch(`${API}/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  });
  if (!res.ok) throw await res.json();
  return res.json(); // { access, refresh }
}
```

---

## Backend dev notes (optional)

- Run tests: `docker compose exec auth-service python manage.py test users -v 2`
- Sample invite email: `docker compose exec auth-service python manage.py send_sample_guardian_invite you@example.com`
