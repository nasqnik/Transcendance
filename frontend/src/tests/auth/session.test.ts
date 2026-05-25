import { describe, it, expect } from 'vitest'
import {
  dashboardPathForRole,
  parentUserFromAccessToken,
  kidUserFromAccessToken,
} from '../../auth/session'

function makeJWT(payload: Record<string, unknown>): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.fake-sig`
}

describe('dashboardPathForRole', () => {
  it('returns /parent/dashboard for role "parent"', () => {
    expect(dashboardPathForRole('parent')).toBe('/parent/dashboard')
  })

  it('returns /dashboard for role "kid"', () => {
    expect(dashboardPathForRole('kid')).toBe('/dashboard')
  })

  it('returns /dashboard for undefined role', () => {
    expect(dashboardPathForRole(undefined)).toBe('/dashboard')
  })
})

describe('parentUserFromAccessToken', () => {
  it('decodes a parent JWT and returns a User with role "parent"', () => {
    const token = makeJWT({
      user_id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
    })
    expect(parentUserFromAccessToken(token)).toEqual({
      id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'parent',
    })
  })
})

describe('kidUserFromAccessToken', () => {
  it('decodes a kid JWT and returns a User with role "kid"', () => {
    const token = makeJWT({
      kid_id: 'k1',
      username: 'kiddo',
    })
    expect(kidUserFromAccessToken(token)).toEqual({
      id: 'k1',
      username: 'kiddo',
      role: 'kid',
    })
  })
})
