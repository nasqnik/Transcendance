import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLanguageBase, isRTLLanguage } from './i18n/config'
import useAuthStore from './store/authStore'
import { verifyToken } from './api/auth'

import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import HomeRoute from './components/HomeRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AcceptInvite from './pages/AcceptInvite'
import NotFound from './pages/NotFound'
import VerifyEmail from './pages/VerifyEmail'
import VerifyKidEmail from './pages/VerifyKidEmail'
import ChildDashboard from './pages/ChildDashboard'
import ParentDashboard from './pages/ParentDashboard'
import CharacterCreation from './pages/CharacterCreation'
import Profile from './pages/Profile'
import ParentProfile from './pages/ParentProfile'

function InviteLegacyRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/accept-invite${search}`} replace />
}

export default function App() {
  const { i18n } = useTranslation()
  const activeLang = i18n.resolvedLanguage ?? i18n.language
  const isRTL = isRTLLanguage(activeLang)
  const { token, logout } = useAuthStore()

  // Capture the token that was in storage when the app first loaded.
  // We only want to verify it once on startup — not on every subsequent
  // auth state change — so we snapshot it into a ref immediately.
  const startupTokenRef = useRef(token)

  useEffect(() => {
    const startupToken = startupTokenRef.current
    if (startupToken) {
      verifyToken(startupToken).then(valid => {
        if (!valid) logout()
      })
    }
  }, [logout])

  useEffect(() => {
    document.documentElement.lang = getLanguageBase(activeLang)
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [activeLang, isRTL])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} lang={getLanguageBase(activeLang)}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/invite" element={<InviteLegacyRedirect />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/kid/verify-email" element={<VerifyKidEmail />} />

          {/* Child (protected) */}
          <Route path="/dashboard" element={
            <ProtectedRoute role="kid">
              <ChildDashboard />
            </ProtectedRoute>
          } />
          <Route path="/character" element={
            <ProtectedRoute role="kid">
              <CharacterCreation />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute role="kid">
              <Profile />
            </ProtectedRoute>
          } />

          {/* Parent (protected) */}
          <Route path="/parent/dashboard" element={
            <ProtectedRoute role="parent">
              <ParentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/parent/profile" element={
            <ProtectedRoute role="parent">
              <ParentProfile />
            </ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
