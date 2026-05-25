import { describe, it, expect } from 'vitest'
import {
  savePendingInviteToken,
  getPendingInviteToken,
  clearPendingInviteToken,
  acceptInvitePath,
} from '../../utils/inviteToken'

describe('savePendingInviteToken / getPendingInviteToken', () => {
  it('returns the saved token after saving', () => {
    savePendingInviteToken('mytoken123')
    expect(getPendingInviteToken()).toBe('mytoken123')
  })

  it('returns null when nothing has been saved', () => {
    expect(getPendingInviteToken()).toBeNull()
  })

  it('returns null after clearing', () => {
    savePendingInviteToken('mytoken123')
    clearPendingInviteToken()
    expect(getPendingInviteToken()).toBeNull()
  })
})

describe('acceptInvitePath', () => {
  it('returns correct path for a simple token', () => {
    expect(acceptInvitePath('abc')).toBe('/accept-invite?token=abc')
  })

  it('URL-encodes special characters in token', () => {
    const token = 'token+special/='
    const path = acceptInvitePath(token)
    expect(path).toBe(`/accept-invite?token=${encodeURIComponent(token)}`)
    // Confirm the token portion is properly encoded (no raw special chars after '?token=')
    const tokenPart = path.split('?token=')[1]
    expect(tokenPart).not.toContain('+')
    expect(tokenPart).not.toContain('/')
    expect(tokenPart).not.toContain('=')
  })
})
