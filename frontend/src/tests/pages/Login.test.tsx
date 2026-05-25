import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login'
import { attemptDualRoleLogin } from '../../auth/loginFlow'

vi.mock('../../auth/loginFlow', () => ({
  attemptDualRoleLogin: vi.fn(),
}))
vi.mock('../../hooks/useAuthHydrated', () => ({
  useAuthHydrated: () => true,
}))
vi.mock('../../components/GoogleSignInSection', () => ({
  default: () => null,
}))
vi.mock('../../components/LanguageSwitcher', () => ({
  default: () => null,
}))

const mockAttemptDualRoleLogin = vi.mocked(attemptDualRoleLogin)

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockAttemptDualRoleLogin.mockResolvedValue({ status: 'success' })
})

describe('Login page', () => {
  it('renders identifier and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('auth.emailOrUsername')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
  })

  it('shows required field errors when form submitted with empty fields', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'auth.login' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
  })

  it('calls attemptDualRoleLogin with correct credentials on submit', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('auth.emailOrUsername'), 'alice@example.com')
    await user.type(screen.getByLabelText('auth.password'), 'mypassword')
    await user.click(screen.getByRole('button', { name: 'auth.login' }))

    expect(mockAttemptDualRoleLogin).toHaveBeenCalledWith(
      { type: 'password', identifier: 'alice@example.com', password: 'mypassword' },
      expect.any(Function)
    )
  })

  it('shows error alert when login returns an error status', async () => {
    mockAttemptDualRoleLogin.mockResolvedValue({
      status: 'error',
      errorKey: 'errors.api.invalidCredentials',
    })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('auth.emailOrUsername'), 'nobody')
    await user.type(screen.getByLabelText('auth.password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'auth.login' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('errors.api.invalidCredentials')
  })

  it('shows waiting-for-parent screen when result is waiting_for_parent', async () => {
    mockAttemptDualRoleLogin.mockResolvedValue({ status: 'waiting_for_parent' })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('auth.emailOrUsername'), 'kiddo')
    await user.type(screen.getByLabelText('auth.password'), 'kidpassword')
    await user.click(screen.getByRole('button', { name: 'auth.login' }))

    const heading = await screen.findByRole('heading', { name: 'auth.waitingForParent' })
    expect(heading).toBeInTheDocument()
  })

  it('"Try logging in again" button resets back to the login form', async () => {
    mockAttemptDualRoleLogin.mockResolvedValue({ status: 'waiting_for_parent' })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('auth.emailOrUsername'), 'kiddo')
    await user.type(screen.getByLabelText('auth.password'), 'kidpassword')
    await user.click(screen.getByRole('button', { name: 'auth.login' }))

    // Wait for the waiting screen to appear
    await screen.findByRole('heading', { name: 'auth.waitingForParent' })

    // Click the "try again" button
    await user.click(screen.getByRole('button', { name: 'auth.tryLoginAgain' }))

    // Login form should be back
    expect(screen.getByLabelText('auth.emailOrUsername')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
  })
})
