import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n/config', () => ({
  default: { t: (key: string) => key },
}))

import {
  isEmailNotVerified,
  isAccountNotFound,
  isKidNotActiveYet,
  getApiErrorKey,
  dualLoginErrorKey,
} from '../../api/errors'

describe('isEmailNotVerified', () => {
  it('returns true for "Verify your email first."', () => {
    expect(
      isEmailNotVerified({ response: { data: { detail: 'Verify your email first.' } } })
    ).toBe(true)
  })

  it('returns true for "Email not verified."', () => {
    expect(
      isEmailNotVerified({ response: { data: { detail: 'Email not verified.' } } })
    ).toBe(true)
  })

  it('returns true for "Please verify your email before logging in."', () => {
    expect(
      isEmailNotVerified({
        response: { data: { detail: 'Please verify your email before logging in.' } },
      })
    ).toBe(true)
  })

  it('returns false for a different detail', () => {
    expect(
      isEmailNotVerified({ response: { data: { detail: 'Wrong error.' } } })
    ).toBe(false)
  })

  it('returns false for null', () => {
    expect(isEmailNotVerified(null)).toBe(false)
  })
})

describe('isAccountNotFound', () => {
  it('returns true for standard credentials error with period', () => {
    expect(
      isAccountNotFound({
        response: { data: { detail: 'No active account found with the given credentials.' } },
      })
    ).toBe(true)
  })

  it('returns true for credentials error without trailing period', () => {
    expect(
      isAccountNotFound({
        response: { data: { detail: 'No active account found with the given credentials' } },
      })
    ).toBe(true)
  })

  it('returns false for a different detail', () => {
    expect(
      isAccountNotFound({ response: { data: { detail: 'Some other error.' } } })
    ).toBe(false)
  })
})

describe('isKidNotActiveYet', () => {
  it('returns true for "Kid account is not active yet."', () => {
    expect(
      isKidNotActiveYet({ response: { data: { detail: 'Kid account is not active yet.' } } })
    ).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(
      isKidNotActiveYet({ response: { data: { detail: 'Some other error.' } } })
    ).toBe(false)
  })

  it('returns false for null', () => {
    expect(isKidNotActiveYet(null)).toBe(false)
  })
})

describe('getApiErrorKey', () => {
  it('maps "No active account found with the given credentials." to invalidCredentials', () => {
    expect(
      getApiErrorKey({
        response: { data: { detail: 'No active account found with the given credentials.' } },
      })
    ).toBe('errors.api.invalidCredentials')
  })

  it('maps google-account-is-kid detail to googleAccountIsKid', () => {
    expect(
      getApiErrorKey({
        response: {
          data: {
            detail: 'This Google account is registered as a kid account. Use kid sign-in instead.',
          },
        },
      })
    ).toBe('errors.api.googleAccountIsKid')
  })

  it('maps email-is-kid-account detail to emailIsKidAccount', () => {
    expect(
      getApiErrorKey({
        response: {
          data: {
            detail: 'This email is registered as a kid account. Use kid sign-in instead.',
          },
        },
      })
    ).toBe('errors.api.emailIsKidAccount')
  })

  it('returns errors.apiUnknown for unknown detail text', () => {
    expect(
      getApiErrorKey({ response: { data: { detail: 'Unknown error text here.' } } })
    ).toBe('errors.apiUnknown')
  })

  it('maps non_field_errors array to usernameTaken', () => {
    expect(
      getApiErrorKey({
        response: { data: { non_field_errors: ['This username is already taken.'] } },
      })
    ).toBe('errors.api.usernameTaken')
  })

  it('returns errors.apiUnknown for empty error object', () => {
    expect(getApiErrorKey({})).toBe('errors.apiUnknown')
  })
})

describe('dualLoginErrorKey', () => {
  const emailNotVerifiedErr = { response: { data: { detail: 'Verify your email first.' } } }
  const accountNotFoundErr = {
    response: { data: { detail: 'No active account found with the given credentials.' } },
  }
  const invalidKidCredsErr = {
    response: { data: { detail: 'No active kid account found with the given credentials.' } },
  }
  const googleIsKidErr = {
    response: {
      data: {
        detail:
          'This Google account is registered as a kid account. Use kid sign-in instead.',
      },
    },
  }
  const accountInactiveErr = {
    response: { data: { detail: 'This account is inactive.' } },
  }
  const kidNotActiveYetErr = {
    response: { data: { detail: 'Kid account is not active yet.' } },
  }

  it('returns emailNotVerified when kid has email-not-verified error', () => {
    expect(dualLoginErrorKey(accountNotFoundErr, emailNotVerifiedErr)).toBe(
      'errors.api.emailNotVerified'
    )
  })

  it('returns invalidCredentials when both are "not found" errors', () => {
    expect(dualLoginErrorKey(accountNotFoundErr, invalidKidCredsErr)).toBe(
      'errors.api.invalidCredentials'
    )
  })

  it('returns accountInactive when parent has specific inactive error', () => {
    expect(dualLoginErrorKey(accountInactiveErr, invalidKidCredsErr)).toBe(
      'errors.api.accountInactive'
    )
  })

  it('returns googleAccountIsKid when parent fails with google-is-kid error (bug-fix test)', () => {
    expect(dualLoginErrorKey(googleIsKidErr, invalidKidCredsErr)).toBe(
      'errors.api.googleAccountIsKid'
    )
  })

  it('returns kidNotActiveYet when parent not found and kid has specific error', () => {
    expect(dualLoginErrorKey(accountNotFoundErr, kidNotActiveYetErr)).toBe(
      'errors.api.kidNotActiveYet'
    )
  })
})
