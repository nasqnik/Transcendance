import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/auth', () => ({
  loginParent: vi.fn(),
  loginKid: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginKidWithGoogle: vi.fn(),
}))
vi.mock('../../auth/session', () => ({
  establishParentSession: vi.fn(),
  establishKidSession: vi.fn(),
  dashboardPathForRole: vi.fn(() => '/'),
  PARENT_DASHBOARD_PATH: '/parent/dashboard',
  KID_DASHBOARD_PATH: '/dashboard',
}))

import { attemptDualRoleLogin } from '../../auth/loginFlow'
import { loginParent, loginKid, loginWithGoogle, loginKidWithGoogle } from '../../api/auth'
import { establishParentSession, establishKidSession } from '../../auth/session'

const mockLoginParent = vi.mocked(loginParent)
const mockLoginKid = vi.mocked(loginKid)
const mockLoginWithGoogle = vi.mocked(loginWithGoogle)
const mockLoginKidWithGoogle = vi.mocked(loginKidWithGoogle)
const mockEstablishParentSession = vi.mocked(establishParentSession)
const mockEstablishKidSession = vi.mocked(establishKidSession)

const parentTokens = { access: 'parent-access', refresh: 'parent-refresh' }
const kidTokens = { access: 'kid-access', refresh: 'kid-refresh' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('password flow', () => {
  it('returns success and calls establishParentSession when parent login succeeds', async () => {
    mockLoginParent.mockResolvedValue(parentTokens)

    const result = await attemptDualRoleLogin({
      type: 'password',
      identifier: 'alice',
      password: 'secret123',
    })

    expect(result).toEqual({ status: 'success' })
    expect(mockEstablishParentSession).toHaveBeenCalledWith(parentTokens, undefined)
    expect(mockLoginKid).not.toHaveBeenCalled()
  })

  it('falls through to kid login when parent fails with account-not-found', async () => {
    mockLoginParent.mockRejectedValue({
      response: { data: { detail: 'No active account found with the given credentials.' } },
    })
    mockLoginKid.mockResolvedValue(kidTokens)

    const result = await attemptDualRoleLogin({
      type: 'password',
      identifier: 'kiddo',
      password: 'secret123',
    })

    expect(result).toEqual({ status: 'success' })
    expect(mockEstablishKidSession).toHaveBeenCalledWith(kidTokens, undefined)
  })

  it('returns waiting_for_parent when parent not found and kid not active yet', async () => {
    mockLoginParent.mockRejectedValue({
      response: { data: { detail: 'No active account found with the given credentials.' } },
    })
    mockLoginKid.mockRejectedValue({
      response: { data: { detail: 'Kid account is not active yet.' } },
    })

    const result = await attemptDualRoleLogin({
      type: 'password',
      identifier: 'kiddo',
      password: 'secret123',
    })

    expect(result).toEqual({ status: 'waiting_for_parent' })
  })

  it('returns error without trying kid when parent fails with email-not-verified', async () => {
    mockLoginParent.mockRejectedValue({
      response: { data: { detail: 'Verify your email first.' } },
    })

    const result = await attemptDualRoleLogin({
      type: 'password',
      identifier: 'alice',
      password: 'secret123',
    })

    expect(result).toEqual({ status: 'error', errorKey: 'errors.api.emailNotVerified' })
    expect(mockLoginKid).not.toHaveBeenCalled()
  })

  it('returns invalidCredentials error when both parent and kid fail with not-found', async () => {
    mockLoginParent.mockRejectedValue({
      response: { data: { detail: 'No active account found with the given credentials.' } },
    })
    mockLoginKid.mockRejectedValue({
      response: { data: { detail: 'No active kid account found with the given credentials.' } },
    })

    const result = await attemptDualRoleLogin({
      type: 'password',
      identifier: 'nobody',
      password: 'secret123',
    })

    expect(result).toEqual({ status: 'error', errorKey: 'errors.api.invalidCredentials' })
  })
})

describe('Google flow', () => {
  it('returns success and calls establishParentSession when parent Google login succeeds', async () => {
    mockLoginWithGoogle.mockResolvedValue(parentTokens)

    const result = await attemptDualRoleLogin({
      type: 'google',
      credential: 'google-id-token',
    })

    expect(result).toEqual({ status: 'success' })
    expect(mockEstablishParentSession).toHaveBeenCalledWith(parentTokens, undefined)
    expect(mockLoginKidWithGoogle).not.toHaveBeenCalled()
  })

  it('falls through to kid Google login when parent fails with google-account-is-kid error', async () => {
    mockLoginWithGoogle.mockRejectedValue({
      response: {
        data: {
          detail:
            'This Google account is registered as a kid account. Use kid sign-in instead.',
        },
      },
    })
    mockLoginKidWithGoogle.mockResolvedValue(kidTokens)

    const result = await attemptDualRoleLogin({
      type: 'google',
      credential: 'google-id-token',
    })

    expect(result).toEqual({ status: 'success' })
    expect(mockEstablishKidSession).toHaveBeenCalledWith(kidTokens, undefined)
  })
})
