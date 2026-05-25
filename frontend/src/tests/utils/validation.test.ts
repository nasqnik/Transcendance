import { describe, it, expect } from 'vitest'
import {
  isEmpty,
  isValidEmail,
  emailsMatchIgnoreCase,
  validatePasswordField,
} from '../../utils/validation'

const t = (key: string) => key

describe('isEmpty', () => {
  it('returns true for empty string', () => {
    expect(isEmpty('')).toBe(true)
  })

  it('returns true for whitespace-only string', () => {
    expect(isEmpty('   ')).toBe(true)
  })

  it('returns false for non-empty string', () => {
    expect(isEmpty('hello')).toBe(false)
  })

  it('returns false for string with whitespace around content', () => {
    expect(isEmpty('  hello  ')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('returns true for a valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('returns false for email missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('returns false for email missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('returns false for email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('returns true for email with subdomains', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })
})

describe('emailsMatchIgnoreCase', () => {
  it('returns true for identical emails', () => {
    expect(emailsMatchIgnoreCase('alice@example.com', 'alice@example.com')).toBe(true)
  })

  it('returns true for emails differing only in case', () => {
    expect(emailsMatchIgnoreCase('Alice@Example.COM', 'alice@example.com')).toBe(true)
  })

  it('returns true for emails with leading/trailing spaces', () => {
    expect(emailsMatchIgnoreCase('  alice@example.com  ', 'alice@example.com')).toBe(true)
  })

  it('returns false for different emails', () => {
    expect(emailsMatchIgnoreCase('alice@example.com', 'bob@example.com')).toBe(false)
  })

  it('returns false when first argument is null', () => {
    expect(emailsMatchIgnoreCase(null, 'alice@example.com')).toBe(false)
  })

  it('returns false when second argument is undefined', () => {
    expect(emailsMatchIgnoreCase('alice@example.com', undefined)).toBe(false)
  })

  it('returns false when both are null', () => {
    expect(emailsMatchIgnoreCase(null, null)).toBe(false)
  })
})

describe('validatePasswordField', () => {
  it('returns errors.required for empty password', () => {
    expect(validatePasswordField('', t)).toBe('errors.required')
  })

  it('returns errors.passwordMinLength for 7-character password', () => {
    expect(validatePasswordField('abcdefg', t)).toBe('errors.passwordMinLength')
  })

  it('returns undefined for valid 8-character password', () => {
    expect(validatePasswordField('abcdefgh', t)).toBeUndefined()
  })

  it('returns errors.passwordEntirelyNumeric for all-digit password', () => {
    expect(validatePasswordField('12345678', t)).toBe('errors.passwordEntirelyNumeric')
  })

  it('returns errors.passwordTooSimilar when password equals username (case-insensitive)', () => {
    expect(validatePasswordField('Alice123', t, { username: 'alice123' })).toBe(
      'errors.passwordTooSimilar'
    )
  })

  it('returns errors.passwordTooSimilar when password equals email local part', () => {
    expect(validatePasswordField('johndoe1', t, { email: 'johndoe1@example.com' })).toBe(
      'errors.passwordTooSimilar'
    )
  })

  it('returns errors.passwordTooSimilar when password equals full email', () => {
    expect(validatePasswordField('user@example.com', t, { email: 'user@example.com' })).toBe(
      'errors.passwordTooSimilar'
    )
  })

  it('returns undefined for valid password with context', () => {
    expect(
      validatePasswordField('securePass99', t, {
        username: 'alice',
        email: 'alice@example.com',
      })
    ).toBeUndefined()
  })
})
