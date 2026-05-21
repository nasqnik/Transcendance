import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLanguageBase, isRTLLanguage } from './i18n/config'
import useAuthStore from './store/authStore'
import { verifyToken } from './api/auth'

import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import AcceptInvite from './pages/AcceptInvite'
import ChildDashboard from './pages/ChildDashboard'
import ParentDashboard from './pages/ParentDashboard'
import CharacterCreation from './pages/CharacterCreation'
import Profile from './pages/Profile'
import ParentProfile from './pages/ParentProfile'

export default function App() {
  const { i18n } = useTranslation()
  const activeLang = i18n.resolvedLanguage ?? i18n.language
  const isRTL = isRTLLanguage(activeLang)
  const { token, logout } = useAuthStore()

  // On startup — verify the stored token is still valid
  // If not, log the user out so they don't see a broken logged-in state
  useEffect(() => {
    if (token) {
      verifyToken(token).then(valid => {
        if (!valid) logout()
      })
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = getLanguageBase(activeLang)
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [activeLang, isRTL])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} lang={getLanguageBase(activeLang)}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

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
        </Routes>
      </BrowserRouter>
    </div>
  )
}
