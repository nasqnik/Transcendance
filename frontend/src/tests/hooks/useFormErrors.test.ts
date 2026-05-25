import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormErrors } from '../../hooks/useFormErrors'

describe('useFormErrors', () => {
  it('initializes with empty fieldErrors', () => {
    const { result } = renderHook(() => useFormErrors())
    expect(result.current.fieldErrors).toEqual({})
  })

  it('setFieldErrors sets errors', () => {
    const { result } = renderHook(() => useFormErrors())

    act(() => {
      result.current.setFieldErrors({ email: 'Required', password: 'Too short' })
    })

    expect(result.current.fieldErrors).toEqual({ email: 'Required', password: 'Too short' })
  })

  it('clearFieldError removes only the specified field', () => {
    const { result } = renderHook(() => useFormErrors())

    act(() => {
      result.current.setFieldErrors({ email: 'Required', password: 'Too short' })
    })
    act(() => {
      result.current.clearFieldError('email')
    })

    expect(result.current.fieldErrors).toEqual({ password: 'Too short' })
    expect(result.current.fieldErrors.email).toBeUndefined()
  })

  it('clearFieldError is a no-op (same reference) when field has no error', () => {
    const { result } = renderHook(() => useFormErrors())

    act(() => {
      result.current.setFieldErrors({ password: 'Too short' })
    })

    const before = result.current.fieldErrors
    act(() => {
      result.current.clearFieldError('email')
    })
    const after = result.current.fieldErrors

    // Same object reference — no re-render triggered
    expect(after).toBe(before)
  })

  it('resetFieldErrors clears all errors', () => {
    const { result } = renderHook(() => useFormErrors())

    act(() => {
      result.current.setFieldErrors({ email: 'Required', password: 'Too short' })
    })
    act(() => {
      result.current.resetFieldErrors()
    })

    expect(result.current.fieldErrors).toEqual({})
  })

  it('clearFieldError is a stable reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFormErrors())

    const first = result.current.clearFieldError
    rerender()
    const second = result.current.clearFieldError

    expect(second).toBe(first)
  })

  it('resetFieldErrors is a stable reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFormErrors())

    const first = result.current.resetFieldErrors
    rerender()
    const second = result.current.resetFieldErrors

    expect(second).toBe(first)
  })
})
