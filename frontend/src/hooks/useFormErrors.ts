import { useCallback, useState } from 'react'

export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const resetFieldErrors = useCallback(() => setFieldErrors({}), [])

  return { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors }
}
