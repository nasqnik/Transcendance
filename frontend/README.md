# KiddoPath — Frontend

A gamified task and learning app for children aged 8–12. This document covers everything you need to know to work on the frontend.

---

## Current status

| Area | Status |
|------|--------|
| Project scaffolding | ✅ Done |
| Tailwind design tokens (colors, fonts) | ✅ Done |
| i18n — EN / RU / AR + RTL | ✅ Done |
| React Router + protected routes | ✅ Done |
| Zustand auth store | ✅ Done |
| Axios client with auth token | ✅ Done |
| Error boundary | ✅ Done |
| Landing page | ✅ Done |
| Login page | ✅ Done |
| Signup page (parent + kid) | ✅ Done |
| Accept-invite page | ✅ Done |
| Parent dashboard (placeholder) | ✅ Done |
| Kid dashboard (placeholder) | ✅ Done |
| Forgot password page | 🔲 Placeholder only |
| Character creation | 🔲 Placeholder only |
| Profile pages | 🔲 Placeholder only |
| Task system | 🔲 Not started |
| Rewards system | 🔲 Not started |
| Avatar builder | 🔲 Not started |
| Google OAuth | 🔲 Not started |

---

## Tech stack

| Tool | Purpose |
|------|---------|
| React 19 + TypeScript | UI framework |
| Vite | Dev server + bundler |
| Tailwind CSS v4 | Styling |
| React Router v6 | Routing |
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

Two separate account types — parent and kid — each with their own login endpoint.

### Parent signup
1. `POST /auth/register/` → account created
2. Auto-login via `POST /auth/token/` → JWT stored
3. Redirect to `/parent/dashboard`

### Kid signup
1. `POST /kids/signup/` → account created with status `awaiting_primary_parent`
2. Backend emails the parent with an invite link
3. Kid sees "Check your parent's email" screen
4. Kid **cannot log in** until a parent accepts

### Parent accepts invite
1. Parent opens `https://localhost/accept-invite?token=<uuid>`
2. If already logged in + email matches → auto-accepted
3. If not logged in → login form shown → accepted after login
4. Kid status becomes `active` → kid can now log in

### Login
One field — no role picker needed:
- Type an **email** (`@` present) → calls parent login endpoint
- Type a **username** (no `@`) → calls kid login endpoint

### Logout
Clears Zustand store + localStorage, redirects to `/`.

---

## Folder structure

```
src/
├── api/
│   ├── client.ts       ← axios instance (auto-attaches token to every request)
│   └── auth.ts         ← all auth API functions (login, signup, invite...)
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── LanguageSwitcher.tsx
│   ├── ProtectedRoute.tsx
│   └── ErrorBoundary.tsx
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
│   ├── ForgotPassword.tsx
│   ├── AcceptInvite.tsx
│   ├── ChildDashboard.tsx
│   ├── ParentDashboard.tsx
│   ├── CharacterCreation.tsx
│   ├── Profile.tsx
│   └── ParentProfile.tsx
├── store/
│   └── authStore.ts    ← Zustand store (persists to localStorage)
├── App.tsx             ← router + RTL direction
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

Routes are defined in `src/App.tsx`. Public routes are open to everyone. Protected routes check authentication and role.

### Adding a new page

```tsx
// 1. Create src/pages/MyPage.tsx
export default function MyPage() {
  return <div>My Page</div>
}

// 2. Add the route in App.tsx
import MyPage from './pages/MyPage'

<Route path="/my-page" element={<MyPage />} />

// 3. For protected pages, wrap with ProtectedRoute
<Route path="/my-page" element={
  <ProtectedRoute role="kid">
    <MyPage />
  </ProtectedRoute>
} />
```

### Navigating between pages

```tsx
import { Link, useNavigate } from 'react-router-dom'

<Link to="/login">Go to login</Link>

const navigate = useNavigate()
navigate('/dashboard')
```

---

## Protected routes

`src/components/ProtectedRoute.tsx` guards pages that require login.

- Not logged in → redirects to `/login`
- Wrong role → redirects to correct dashboard (`/dashboard` for kid, `/parent/dashboard` for parent)

```tsx
<ProtectedRoute role="kid">      // kid only
<ProtectedRoute role="parent">   // parent only
<ProtectedRoute>                 // any logged-in user
```

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
