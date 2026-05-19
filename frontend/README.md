# KiddoPath — Frontend

A gamified task and learning app for children aged 8–12. This document covers everything you need to know to work on the frontend.

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
| Lucide React | Icons |
| DiceBear | Character avatars |

---

## Running the frontend

```bash
# First time or after adding new packages
make fclean && make build-front && make up-front

# After changing source files only (hot reload handles it automatically)
make up-front

# After adding new npm packages
make build-front && make restart-front

# View logs
make logs-front

# Open a shell inside the container
make shell-front

# Stop everything
make down
```

The app runs at `http://localhost:5173`.

---

## Folder structure

```
src/
├── api/          ← axios client + all API call functions
├── components/   ← reusable UI components (Button, Input, Card...)
├── config/       ← app configuration (rewards, constants...)
├── hooks/        ← custom React hooks (useAuth, useWebSocket...)
├── i18n/         ← i18next config + translation files
│   └── locales/
│       ├── en.json
│       ├── ru.json
│       └── ar.json
├── pages/        ← full page components (Landing, Login, Signup...)
├── store/        ← Zustand stores
├── App.tsx       ← router setup + RTL direction
├── main.tsx      ← app entry point, providers
└── index.css     ← Tailwind + design tokens
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

### Using translations in a component

```tsx
import { useTranslation } from 'react-i18next'

export default function Login() {
  const { t } = useTranslation()

  return <button>{t('auth.login')}</button>
}
```

### Adding a new string

1. Add the key to all three locale files:

```json
// src/i18n/locales/en.json
{ "auth": { "newKey": "My text" } }

// src/i18n/locales/ru.json
{ "auth": { "newKey": "Мой текст" } }

// src/i18n/locales/ar.json
{ "auth": { "newKey": "نصي" } }
```

2. Use it in your component:
```tsx
t('auth.newKey')
```

### Supported languages

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `ru` | Russian | LTR |
| `ar` | Arabic | RTL |

RTL layout switches automatically when Arabic is selected — the `dir` attribute is set on the root element in `App.tsx`.

---

## React Router

Routes are defined in `src/App.tsx`.

### Adding a new page

1. Create the page component:
```tsx
// src/pages/MyPage.tsx
export default function MyPage() {
  return <div>My Page</div>
}
```

2. Add the route in `App.tsx`:
```tsx
import MyPage from './pages/MyPage'

<Route path="/my-page" element={<MyPage />} />
```

3. To make it protected, wrap it:
```tsx
<Route path="/my-page" element={
  <ProtectedRoute role="child">
    <MyPage />
  </ProtectedRoute>
} />
```

### Navigating between pages

```tsx
import { Link, useNavigate } from 'react-router-dom'

// As a link
<Link to="/login">Go to login</Link>

// Programmatically
const navigate = useNavigate()
navigate('/dashboard')
```

---

## Protected routes

`src/components/ProtectedRoute.tsx` guards pages that require authentication.

- If the user is not logged in → redirects to `/login`
- If the user has the wrong role → redirects to their correct dashboard

```tsx
// Child-only page
<ProtectedRoute role="child">
  <ChildDashboard />
</ProtectedRoute>

// Parent-only page
<ProtectedRoute role="parent">
  <ParentDashboard />
</ProtectedRoute>

// Any authenticated user
<ProtectedRoute>
  <AnyPage />
</ProtectedRoute>
```

---

## Zustand auth store

`src/store/authStore.ts` holds the global auth state. It persists to `localStorage` so the user stays logged in after a page refresh.

### Reading state in a component

```tsx
import useAuthStore from '../store/authStore'

export default function Navbar() {
  const { currentUser, isAuthenticated, logout } = useAuthStore()

  return (
    <nav>
      {isAuthenticated && <span>{currentUser?.name}</span>}
      <button onClick={logout}>Log out</button>
    </nav>
  )
}
```

### Logging in (called after a successful API response)

```tsx
const { login } = useAuthStore()

login(
  { id: '1', email: 'user@email.com', name: 'Ana', role: 'parent' },
  'the-token-from-backend'
)
```

---

## TanStack Query + Axios client

`src/api/client.ts` is a pre-configured axios instance that:
- Points to `VITE_API_URL` (defaults to `http://localhost:8000`)
- Automatically attaches the auth token to every request

### Making an API call

1. Create the function in `src/api/`:
```ts
// src/api/tasks.ts
import client from './client'

export const getTasks = () =>
  client.get('/api/tasks/').then(res => res.data)
```

2. Use it in a component with TanStack Query:
```tsx
import { useQuery } from '@tanstack/react-query'
import { getTasks } from '../api/tasks'

export default function TaskList() {
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading tasks</div>

  return (
    <ul>
      {tasks.map(task => <li key={task.id}>{task.title}</li>)}
    </ul>
  )
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |
| `VITE_GOOGLE_CLIENT_ID` | — | Google OAuth client ID |

---

## Error boundary

`src/components/ErrorBoundary.tsx` wraps the entire app in `main.tsx`. If any component crashes, it shows a friendly error message instead of a blank screen. No action needed — it works automatically.

---

## Accessibility rules

Every component we write follows WCAG 2.1 AA:

- Use semantic HTML — `<button>` for buttons, `<nav>` for navigation, `<main>` for main content
- Every image has an `alt` attribute
- Every form input has a `<label>`
- Never remove `outline` on focused elements — keyboard users need to see focus
- Color is never the only way to convey information
- Minimum contrast ratio of 4.5:1 for text
