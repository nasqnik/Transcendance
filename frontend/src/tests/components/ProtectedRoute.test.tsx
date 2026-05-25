import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'
import useAuthStore from '../../store/authStore'
import { useAuthHydrated } from '../../hooks/useAuthHydrated'

vi.mock('../../hooks/useAuthHydrated', () => ({
  useAuthHydrated: vi.fn(),
}))
vi.mock('../../components/AuthHydrationFallback', () => ({
  default: () => <div data-testid="hydration-fallback">Loading</div>,
}))

const mockUseAuthHydrated = vi.mocked(useAuthHydrated)

function renderRoute(role?: 'parent' | 'kid') {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute role={role}>
              <div data-testid="protected-content">Protected</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/dashboard" element={<div data-testid="kid-dashboard">Kid Dashboard</div>} />
        <Route
          path="/parent/dashboard"
          element={<div data-testid="parent-dashboard">Parent Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthStore.setState({
    currentUser: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  })
})

describe('ProtectedRoute', () => {
  it('shows hydration fallback while useAuthHydrated returns false', () => {
    mockUseAuthHydrated.mockReturnValue(false)
    renderRoute()
    expect(screen.getByTestId('hydration-fallback')).toBeInTheDocument()
  })

  it('does not show protected content while hydrating', () => {
    mockUseAuthHydrated.mockReturnValue(false)
    renderRoute()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to /login when hydrated but not authenticated', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    renderRoute()
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('shows protected content when hydrated, authenticated, correct role (parent)', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    useAuthStore.setState({
      currentUser: { id: '1', username: 'alice', email: 'alice@example.com', role: 'parent' },
      token: 'tok',
      refreshToken: 'ref',
      isAuthenticated: true,
    })
    renderRoute('parent')
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('shows protected content when hydrated, authenticated, correct role (kid)', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    useAuthStore.setState({
      currentUser: { id: '2', username: 'kiddo', role: 'kid' },
      token: 'tok',
      refreshToken: 'ref',
      isAuthenticated: true,
    })
    renderRoute('kid')
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects kid to /dashboard when trying to access parent route', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    useAuthStore.setState({
      currentUser: { id: '2', username: 'kiddo', role: 'kid' },
      token: 'tok',
      refreshToken: 'ref',
      isAuthenticated: true,
    })
    renderRoute('parent')
    expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects parent to /parent/dashboard when trying to access kid route', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    useAuthStore.setState({
      currentUser: { id: '1', username: 'alice', email: 'alice@example.com', role: 'parent' },
      token: 'tok',
      refreshToken: 'ref',
      isAuthenticated: true,
    })
    renderRoute('kid')
    expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('shows protected content when no role requirement and authenticated', () => {
    mockUseAuthHydrated.mockReturnValue(true)
    useAuthStore.setState({
      currentUser: { id: '1', username: 'alice', email: 'alice@example.com', role: 'parent' },
      token: 'tok',
      refreshToken: 'ref',
      isAuthenticated: true,
    })
    renderRoute()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})
