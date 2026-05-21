import axios from 'axios'
import useAuthStore from '../store/authStore'

// VITE_API_URL should be set to https://localhost/api in docker-compose
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://localhost/api',
})

// ── Request interceptor ───────────────────────────────────────────────────────
// Runs before every request — attaches the access token if we have one
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

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
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const { refreshToken, currentUser, login, logout } = useAuthStore.getState()

    // If we don't have a refresh token, log the user out immediately
    if (!refreshToken) {
      logout()
      return Promise.reject(error)
    }

    // Mark this request so we don't retry it again if refresh also fails
    originalRequest._retry = true

    try {
      // Parent and kid have different refresh endpoints
      const refreshEndpoint = currentUser?.role === 'kid'
        ? '/auth/kid/token/refresh/'
        : '/auth/token/refresh/'

      // Call the refresh endpoint directly with axios (not client)
      // so this request doesn't go through our interceptor again
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'https://localhost/api'}${refreshEndpoint}`,
        { refresh: refreshToken },
      )

      const newAccessToken = res.data.access
      const newRefreshToken = res.data.refresh

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
