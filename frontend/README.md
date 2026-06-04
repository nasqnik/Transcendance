# KiddoPath — Frontend

A gamified task and learning app for children aged 8–12. This document covers everything you need to know to work on the frontend.

---

## Current status

| Area | Status |
|------|--------|
| Project scaffolding | ✅ Done |
| Tailwind design tokens (colors, fonts) | ✅ Done |
| i18n — EN / RU / AR + RTL | ✅ Done |
| React Router (layout routes + guards) | ✅ Done |
| Unit tests (Vitest) | ✅ Done |
| Zustand auth store | ✅ Done |
| Axios client with auth token | ✅ Done |
| Error boundary | ✅ Done |
| Landing page | ✅ Done |
| Login page | ✅ Done |
| Signup page (parent + kid) | ✅ Done |
| Accept-invite page | ✅ Done |
| Parent dashboard (placeholder) | ✅ Done |
| Kid dashboard — layout + components | ✅ Done |
| Kid dashboard — TodaysTasks (UI + mock data) | ✅ Done |
| Kid dashboard — TasksAll modal (view all) | ✅ Done |
| Kid dashboard — KidStats panel | ✅ Done |
| Kid dashboard — KidUserMenu + invite parent flow | ✅ Done |
| Forgot password | — Not planned (no route) |
| Character creation | 🔲 Placeholder only |
| Profile pages | 🔲 Placeholder only |
| Task system — wire to API | 🔲 Not started |
| Task system — Add New Task | 🔲 Not started |
| Rewards system | 🔲 Not started |
| Avatar builder | 🔲 Not started |
| Google sign-in (login, signup, accept-invite) | ✅ Done |

---

## Tech stack

| Tool | Purpose |
|------|---------|
| React 19 + TypeScript | UI framework |
| Vite | Dev server + bundler |
| Tailwind CSS v4 | Styling |
| React Router v7 | Routing (layout routes + `<Outlet />`) |
| Zustand | Global auth state |
| TanStack Query | Data fetching + caching |
| Axios | HTTP client |
| i18next + react-i18next | Internationalization |

---

## Running the full stack

The frontend runs behind nginx. Always use **https://localhost** in the browser — not `http://localhost:5173`. API calls are blocked by CORS when accessed directly from the Vite port.

```bash
# First time setup
cp .env.example .env       # then set DOCKER_UID / DOCKER_GID (run: id -u && id -g)
make all                   # builds everything + runs DB migrations
```

Open **https://localhost** — accept the self-signed certificate warning once.

```bash
# Everyday commands
make all                   # start everything
make down                  # stop everything
make logs-front            # frontend logs
make logs                  # backend logs
make shell-front           # shell inside frontend container
```

### Frontend tests

```bash
cd frontend
npm run test:run    # single run (CI)
npm test            # watch mode
```

---

### Adding new npm packages

Packages install inside Docker — you can't just run `npm install` locally.

```bash
# 1. Add the package to frontend/package.json manually, or:
docker compose exec frontend npm install <package-name>

# 2. Rebuild the container to bake the new package into the image
make fclean && make build-front && make up-front
```

---

## Auth flow

Two account types — **parent** and **kid** — with separate API endpoints.

**Route groups in `App.tsx`:**
- **`GuestRoute`** — `/`, `/login`, `/signup` (guests only; logged-in users go to their dashboard)
- **Open** — `/accept-invite`, `/verify-email`, `/kid/verify-email` (usable while logged in or out)
- **`ProtectedRoute role="kid"`** — `/dashboard`, `/character`, `/profile`
- **`ProtectedRoute role="parent"`** — `/parent/dashboard`, `/parent/profile`
- **`*`** — `NotFound` page

### Parent signup (password)
1. `POST /auth/register/` → account created (email not verified yet)
2. UI shows “check your email” (no auto-login)
3. Parent opens `/verify-email?token=...` → `POST /auth/verify-email/`
4. Parent logs in at `/login`

Parent signup via **Google** on `/signup` logs in immediately and goes to `/parent/dashboard`.

### Kid signup
1. `POST /kids/signup/` or `POST /kids/signup/google/` → `awaiting_primary_parent`
2. Kid verifies email (password path) via `/kid/verify-email?token=...`
3. Backend emails parent → `/accept-invite?token=...`
4. Kid **cannot log in** until a parent accepts

### Parent accepts invite
1. Parent opens `/accept-invite?token=<uuid>`
2. If logged in as parent with matching email → auto-accept
3. Else: password and/or Google on the invite page → accept
4. New parent: register → verify email → return to invite link
5. Kid becomes `active`

`sessionStorage` keeps the invite token across parent email verification (same browser). Re-open the invite email if needed on another device.

### Login
Single form; frontend tries **parent** first, then **kid** (password and Google via `auth/loginFlow.ts`):
- Parent success → `/parent/dashboard`
- Kid success → `/dashboard`
- Kid not active yet → waiting-for-parent screen

Password reset is not planned for the current scope.

### Logout
Clears Zustand persist → redirects to `/`.

### Manual E2E test checklist

Run with Docker stack up, mail catcher or backend logs for links, and `VITE_GOOGLE_CLIENT_ID` if testing Google.

**English (LTR) — happy path**
- [ ] Child signup (password) → kid verify email → waiting UI
- [ ] Parent accept invite (password, new account) → verify → return to invite → success → dashboard
- [ ] Child login → `/dashboard`
- [ ] Parent signup (password) → verify → login → `/parent/dashboard`
- [ ] Logout from dashboard returns home

**Arabic (RTL)**
- [ ] Switch language to AR on login/signup/invite; layout mirrors, labels readable
- [ ] Email fields type left-to-right correctly
- [ ] Submit forms still succeed

**Keyboard & screen reader (spot check)**
- [ ] Tab through login form, Google button, language switcher
- [ ] Signup: choose role with Tab + Space on radio labels; form fields reachable
- [ ] Submit empty form → field errors announced (`role="alert"`)
- [ ] Invite loading → success or error updates announced (`aria-live`)

**Edge cases**
- [ ] Unknown URL (e.g. `/nope`) → 404 page with “Back to home”
- [ ] Hard-refresh `/login` or `/parent/dashboard` while logged in → brief spinner, no login/dashboard flash
- [ ] Open invite link twice after accept → success + “Log in” if not signed in
- [ ] Wrong invite token → error, no stale “return to invite” from verify
- [ ] Signup: fill parent fields, switch to child → fields cleared
- [ ] Logged-in kid opens invite link → parent-only error

---

## Folder structure

```
src/
├── api/
│   ├── client.ts       ← axios instance (auto-attaches token to every request)
│   └── auth.ts         ← all auth API functions (login, signup, invite...)
├── auth/
│   ├── session.ts      ← JWT → auth store (+ optional navigate)
│   └── loginFlow.ts    ← parent-then-kid login (password + Google)
├── components/
│   ├── AuthHydrationFallback.tsx  ← spinner while auth rehydrates
│   ├── AuthMessageLayout.tsx
│   ├── GoogleSignInSection.tsx
│   ├── GuestRoute.tsx             ← layout: guests only; renders <Outlet />
│   ├── ProtectedRoute.tsx         ← layout: auth + role; renders <Outlet />
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── FormField.tsx
│   ├── LanguageSwitcher.tsx
│   ├── ErrorBoundary.tsx
│   └── kid/                       ← all kid dashboard components
│       ├── KidSidebar.tsx         ← left nav (logo + Home link)
│       ├── KidTopbar.tsx          ← greeting header + user menu
│       ├── KidUserMenu.tsx        ← avatar dropdown (logout + invite parent flow)
│       ├── TodaysTasks.tsx        ← task list with pending/done/empty states
│       ├── TasksAll.tsx           ← "View all" modal overlay
│       └── KidStats.tsx           ← stats panel (mock data)
├── constants/
│   └── categories.ts              ← TaskCategory type + CATEGORY_STYLE map
├── hooks/
│   ├── useAuthHydrated.ts  ← true after Zustand rehydrates from localStorage
│   ├── useFormErrors.ts
│   └── usePageTitle.ts
├── i18n/
│   ├── config.ts
│   └── locales/
│       ├── en.json
│       ├── ru.json
│       └── ar.json
├── pages/
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── AcceptInvite.tsx
│   ├── VerifyEmail.tsx
│   ├── VerifyKidEmail.tsx
│   ├── NotFound.tsx
│   ├── ChildDashboard.tsx
│   ├── ParentDashboard.tsx
│   ├── CharacterCreation.tsx
│   ├── Profile.tsx
│   └── ParentProfile.tsx
├── store/
│   └── authStore.ts    ← Zustand store (persists to localStorage)
├── tests/              ← Vitest (api, auth, components, pages, utils)
├── App.tsx             ← routes, startup token verify, `<html>` lang/dir
├── main.tsx            ← entry point, providers
└── index.css           ← Tailwind + design tokens
```

---

## Tailwind design tokens

Colors and fonts are defined once in `src/index.css` under `@theme`. Use them as regular Tailwind classes.

### Colors

| Token | Class example | Usage |
|-------|--------------|-------|
| `primary` | `bg-primary-500` | Main brand color (purple) |
| `teal` | `text-teal-500` | Success, positive actions |
| `amber` | `bg-amber-500` | Warnings, XP, rewards |
| `danger` | `text-danger-500` | Errors, destructive actions |
| `gray` | `bg-gray-50` | Backgrounds, text, borders |

Each color has shades: `50`, `100`, `500`, `600`, `700`.

### Fonts

```tsx
<h1 className="font-heading">KiddoPath</h1>  // Fredoka
<p className="font-body">Hello</p>            // Nunito
```

### RTL padding — always use logical properties

```tsx
// ✅ correct — works in both LTR and RTL
<div className="ps-4 pe-4">

// ❌ wrong — breaks in RTL
<div className="pl-4 pr-4">
```

---

## Internationalization (i18n)

Every user-facing string must go through `t()`. Never hardcode text.

```tsx
import { useTranslation } from 'react-i18next'

export default function MyPage() {
  const { t } = useTranslation()
  return <button>{t('auth.login')}</button>
}
```

### Adding a new string

Add the key to **all three** locale files, then use it:

```json
// en.json  →  "mySection": { "myKey": "Hello" }
// ru.json  →  "mySection": { "myKey": "Привет" }
// ar.json  →  "mySection": { "myKey": "مرحبا" }
```

```tsx
t('mySection.myKey')
```

### Interpolation (variables inside strings)

```json
{ "greeting": "Hello, {{name}}!" }
```
```tsx
t('greeting', { name: 'Ana' })  // → "Hello, Ana!"
```

---

## React Router

Routes live in `src/App.tsx`. Guards are **layout routes**: they render `<Outlet />` for child routes instead of wrapping each page in JSX.

`App` does **not** subscribe to the auth store (only reads `getState()` once for startup token verify). Guards and pages subscribe where needed.

### Route map

| Group | Paths | Guard |
|-------|--------|--------|
| Guest | `/`, `/login`, `/signup` | `GuestRoute` |
| Open | `/accept-invite`, `/verify-email`, `/kid/verify-email` | — |
| Kid | `/dashboard`, `/character`, `/profile` | `ProtectedRoute role="kid"` |
| Parent | `/parent/dashboard`, `/parent/profile` | `ProtectedRoute role="parent"` |
| Fallback | anything else | `NotFound` |

### Adding a new page

```tsx
// 1. Create src/pages/MyPage.tsx
export default function MyPage() {
  return <div>My Page</div>
}

// 2. Public page (anyone)
import MyPage from './pages/MyPage'
<Route path="/my-page" element={<MyPage />} />

// 3. Guest-only (login/signup style)
<Route element={<GuestRoute />}>
  <Route path="/my-page" element={<MyPage />} />
</Route>

// 4. Kid-only (add inside existing kid group)
<Route element={<ProtectedRoute role="kid" />}>
  <Route path="/my-page" element={<MyPage />} />
</Route>
```

### Navigating between pages

```tsx
import { Link, useNavigate } from 'react-router-dom'

<Link to="/login">Go to login</Link>

const navigate = useNavigate()
navigate('/dashboard')
```

---

## Route guards

`ProtectedRoute` and `GuestRoute` use `useAuthHydrated()` and show `AuthHydrationFallback` until Zustand has rehydrated from `localStorage` (avoids redirect flash on refresh).

| Guard | When hydrated |
|--------|----------------|
| **GuestRoute** | Logged in → dashboard for role; else → `<Outlet />` (child page) |
| **ProtectedRoute** | Not logged in → `/login`; wrong role → other dashboard; else → `<Outlet />` |

```tsx
// App.tsx — layout route pattern (not children props)
<Route element={<GuestRoute />}>
  <Route path="/login" element={<Login />} />
</Route>

<Route element={<ProtectedRoute role="kid" />}>
  <Route path="/dashboard" element={<ChildDashboard />} />
</Route>
```

### RTL / `lang` on `<html>`

`App.tsx` sets `document.documentElement.lang` and `.dir` in `useLayoutEffect` from `i18n` (no extra wrapper div). Field-level `dir="ltr"` is still used for email/username inputs in RTL locales.

---

## Zustand auth store

`src/store/authStore.ts` holds the global auth state. It persists to `localStorage` so the user stays logged in after a page refresh.

### User shape

```ts
interface User {
  id: string
  username: string
  email?: string   // parents have email, kids don't
  role: 'parent' | 'kid'
}
```

### Reading state

```tsx
import useAuthStore from '../store/authStore'

const { currentUser, isAuthenticated, logout } = useAuthStore()
```

### Logging in (called after a successful API response)

```tsx
const login = useAuthStore(state => state.login)

login(
  { id: 'uuid', username: 'ana', email: 'ana@email.com', role: 'parent' },
  'access-token',
  'refresh-token',
)
```

### Logging out

```tsx
const logout = useAuthStore(state => state.logout)
logout()
navigate('/')
```

---

## API layer

### `src/api/client.ts`

A pre-configured axios instance that:
- Points to `VITE_API_URL` (set to `https://localhost/api` via docker-compose)
- Automatically attaches `Authorization: Bearer <token>` to every request

Never use `fetch()` directly — always use this client.

### `src/api/auth.ts`

All auth-related API calls live here. Functions available:

| Function | Endpoint | Description |
|----------|----------|-------------|
| `loginParent(email, password)` | `POST /auth/token/` | Parent login → tokens |
| `loginKid(username, password)` | `POST /auth/kid/token/` | Kid login → tokens |
| `registerParent(email, username, password)` | `POST /auth/register/` | Parent signup |
| `signupKid(name, username, password, parent_email)` | `POST /kids/signup/` | Kid signup |
| `getInvitation(token)` | `GET /guardian-invitations/{token}/` | Fetch invite details |
| `acceptInvitation(token)` | `POST /guardian-invitations/accept/` | Accept invite (parent JWT required) |
| `decodeJWT(token)` | — | Decode JWT payload (no library needed) |
| `parseApiError(error)` | — | Turn backend error into a plain string |

### Adding a new API file

```ts
// src/api/tasks.ts
import client from './client'

export async function getTasks() {
  const res = await client.get('/tasks/')
  return res.data
}
```

### Using it in a component with TanStack Query

```tsx
import { useQuery } from '@tanstack/react-query'
import { getTasks } from '../api/tasks'

const { data: tasks, isLoading, error } = useQuery({
  queryKey: ['tasks'],
  queryFn: getTasks,
})
```

---

## Error boundary

`src/components/ErrorBoundary.tsx` wraps the entire app. If any component crashes, it shows a friendly error message instead of a blank screen. No action needed — it works automatically.

---

## Accessibility rules

Every component follows WCAG 2.1 AA:

- Semantic HTML — `<button>` for buttons, `<main>` for main content, `<label>` for every input
- `aria-labelledby` on `<main>` pointing to the page `<h1>`
- `aria-live="polite"` for dynamic content changes (e.g. form appearing after role selection)
- `role="alert"` on error messages
- `focus-ring` class on every interactive element (keyboard navigation)
- Never remove `outline` on focused elements
- Color is never the only way to convey information
