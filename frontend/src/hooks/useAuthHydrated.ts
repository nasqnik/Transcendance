import { useEffect, useState } from 'react'
import useAuthStore from '../store/authStore'

/** True after persisted auth state has been read from localStorage. */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  return hydrated
}
