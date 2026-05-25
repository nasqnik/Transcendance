import axios from 'axios'
import useAuthStore from '../store/authStore'

// VITE_API_URL should be set to https://localhost/api in docker-compose
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://localhost/api'

const client = axios.create({
  baseURL: API_BASE_URL,
})

/** Login/register 401 means bad credentials — not an expired session. */
const AUTH_PATHS_NO_REFRESH = [
  '/auth/token/',
  '/auth/kid/token/',
  '/auth/register/',
  '/auth/google/',
  '/auth/kid/google/',
]

function isCredentialRequest(url?: string): boolean {
  if (!url) return false
  return AUTH_PATHS_NO_REFRESH.some(path => url.includes(path))
}

// ── Request interceptor ───────────────────────────────────────────────────────
// Runs before every request — attaches the access token if we have one
client.interceptors.request.use((config) => {
  if (config.skipAuth) return config

  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Shared promise across concurrent 401s — prevents multiple simultaneous refresh calls
// (token rotation means the second call would fail and cause an unnecessary logout)
let refreshPromise: Promise<{ access: string; refresh: string }> | null = null

// ── Response interceptor ──────────────────────────────────────────────────────
// Runs after every response comes back.
// If the server returns 401 (token expired), we try to get a new token
// using the refresh token, then retry the original request silently.
client.interceptors.response.use(
  // Success — just pass the response through, nothing to do
  (response) => response,

  // Error — check if it's a 401 and handle token refresh
  async (error) => {
    const originalRequest = error.config

    // Only handle 401 errors, and only once per request (avoid infinite loop)
    // _retry is a custom flag we set so we don't retry the retry
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isCredentialRequest(originalRequest.url)
    ) {
      return Promise.reject(error)
    }

    const { refreshToken, currentUser, login, logout } = useAuthStore.getState()

    if (!refreshToken) {
      return Promise.reject(error)
    }

    // Mark this request so we don't retry it again if refresh also fails
    originalRequest._retry = true

    try {
      // Parent and kid have different refresh endpoints
      const refreshEndpoint = currentUser?.role === 'kid'
        ? '/auth/kid/token/refresh/'
        : '/auth/token/refresh/'

      // Reuse an in-flight refresh rather than firing a second one —
      // token rotation would cause the second call to fail and log the user out
      if (!refreshPromise) {
        refreshPromise = axios.post(
          `${API_BASE_URL}${refreshEndpoint}`,
          { refresh: refreshToken },
        )
          .then(res => ({ access: res.data.access, refresh: res.data.refresh }))
          .finally(() => { refreshPromise = null })
      }

      const { access: newAccessToken, refresh: newRefreshToken } = await refreshPromise

      // Save the new tokens — keep everything else the same
      login(currentUser!, newAccessToken, newRefreshToken)

      // Retry the original request with the new access token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return client(originalRequest)

    } catch {
      // Refresh failed (refresh token expired or invalid) → log out
      logout()
      return Promise.reject(error)
    }
  }
)

export default client
