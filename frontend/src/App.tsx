import { useEffect, useLayoutEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from './store/authStore'
import { verifyAccessToken, decodeJWT } from './api/auth'

import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AcceptInvite from './pages/AcceptInvite'
import NotFound from './pages/NotFound'
import VerifyEmail from './pages/VerifyEmail'
import VerifyKidEmail from './pages/VerifyKidEmail'
import KidLayout from './components/kid/KidLayout'
import ChildDashboard from './pages/ChildDashboard'
import KidSettings from './pages/KidSettings'
import ParentDashboard from './pages/ParentDashboard'
import CharacterCreation from './pages/CharacterCreation'
import Profile from './pages/Profile'
import ParentProfile from './pages/ParentProfile'

export default function App() {
  const { i18n } = useTranslation()
  const activeLang = i18n.resolvedLanguage ?? i18n.language
  const isRTL = i18n.dir() === 'rtl'
  // Read token once on startup without subscribing App to the store.
  // Route guards (ProtectedRoute, GuestRoute) handle auth state reactivity themselves.
  const startupTokenRef = useRef(useAuthStore.getState().token)
  const startupRoleRef = useRef((() => {
    const state = useAuthStore.getState()
    return state.currentUser?.role
      ?? (decodeJWT(state.token ?? '').role === 'kid' ? 'kid' : 'parent')
  })() as 'parent' | 'kid')

  useEffect(() => {
    const startupToken = startupTokenRef.current
    if (startupToken) {
      verifyAccessToken(startupToken, startupRoleRef.current).then(valid => {
        if (!valid) useAuthStore.getState().logout()
      })
    }
  }, [])

  useLayoutEffect(() => {
    document.documentElement.lang = activeLang
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [activeLang, isRTL])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route element={<GuestRoute />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/kid/verify-email" element={<VerifyKidEmail />} />

        {/* Child (protected) */}
        <Route element={<ProtectedRoute role="kid" />}>
          <Route element={<KidLayout />}>
            <Route path="/dashboard" element={<ChildDashboard />} />
            <Route path="/settings" element={<KidSettings />} />
          </Route>
          <Route path="/character" element={<CharacterCreation />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Parent (protected) */}
        <Route element={<ProtectedRoute role="parent" />}>
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/parent/profile" element={<ParentProfile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
