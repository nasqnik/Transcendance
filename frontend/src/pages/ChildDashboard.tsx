import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import Button from '../components/Button'
import FormField from '../components/FormField'
import FormAlert from '../components/FormAlert'
import { inviteParent } from '../api/auth'
import { getApiErrorKey } from '../api/errors'
import { useFormErrors } from '../hooks/useFormErrors'
import { usePageTitle } from '../hooks/usePageTitle'
import { isValidEmail, isEmpty } from '../utils/validation'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskCategory = 'health' | 'learning' | 'responsibility' | 'honesty'

interface Task {
  id: string
  title: string
  category: TaskCategory
  points: number
  completed: boolean
}

// ─── Mock data (replace with API calls later) ─────────────────────────────────

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Play soccer for 30 minutes', category: 'health',         points: 20, completed: true },
  { id: '2', title: 'Read for 20 minutes',         category: 'learning',       points: 15, completed: true },
  { id: '3', title: 'Make my bed',                 category: 'responsibility', points: 10, completed: false },
  { id: '4', title: 'Drink 6 glasses of water',    category: 'health',         points: 10, completed: false },
]

const MOCK_STATS: { category: TaskCategory; value: number }[] = [
  { category: 'health',         value: 80 },
  { category: 'learning',       value: 70 },
  { category: 'responsibility', value: 60 },
  { category: 'honesty',        value: 90 },
]

const MOCK_XP    = 650
const MOCK_XP_MAX = 900
const MOCK_LEVEL  = 12
const MOCK_STREAK = 7
const MOCK_POINTS = 1250

// ─── Category styling ─────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<TaskCategory, { bg: string; text: string; bar: string; icon: string }> = {
  health:         { bg: 'bg-teal-50',    text: 'text-teal-500',    bar: 'bg-teal-500',    icon: '❤️' },
  learning:       { bg: 'bg-blue-50',    text: 'text-blue-500',    bar: 'bg-blue-500',    icon: '📘' },
  responsibility: { bg: 'bg-amber-50',   text: 'text-amber-500',   bar: 'bg-amber-500',   icon: '🏆' },
  honesty:        { bg: 'bg-primary-50', text: 'text-primary-500', bar: 'bg-primary-500', icon: '🛡️' },
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '🏠', labelKey: 'kidDash.nav.home',     path: '/dashboard' },
  { icon: '📋', labelKey: 'kidDash.nav.tasks',    path: '/tasks' },
  { icon: '🗺️', labelKey: 'kidDash.nav.journey',  path: '/journey' },
  { icon: '🎁', labelKey: 'kidDash.nav.rewards',  path: '/rewards' },
  { icon: '👥', labelKey: 'kidDash.nav.friends',  path: '/friends' },
  { icon: '📊', labelKey: 'kidDash.nav.progress', path: '/progress' },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChildDashboard() {
  const { t } = useTranslation()
  usePageTitle(t('app.name'))
  const navigate = useNavigate()
  const { currentUser, logout } = useAuthStore()

  // ── Task state ─────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)

  function toggleTask(id: string) {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  // ── Invite parent state ────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [usernameHint, setUsernameHint] = useState('')
  const [inviteErrorKey, setInviteErrorKey] = useState<string | null>(null)
  const { fieldErrors, setFieldErrors, clearFieldError, resetFieldErrors } = useFormErrors()
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo]       = useState<string | null>(null)

  async function handleInvite(e: React.SubmitEvent) {
    e.preventDefault()
    setInviteErrorKey(null)

    const errs: Record<string, string> = {}
    if (isEmpty(inviteEmail)) errs.email = t('errors.required')
    else if (!isValidEmail(inviteEmail)) errs.email = t('errors.invalidEmail')
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    resetFieldErrors()
    setIsLoading(true)

    try {
      await inviteParent(inviteEmail, usernameHint || undefined)
      setSentTo(inviteEmail)
      setInviteEmail('')
      setUsernameHint('')
    } catch (err) {
      setInviteErrorKey(getApiErrorKey(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-primary-50">

      {/* ══ Sidebar ══════════════════════════════════════════════════════════ */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Logo */}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">⭐</span>
            <div>
              <div className="font-heading font-bold text-primary-700 text-lg leading-tight">
                {t('app.name')}
              </div>
              <div className="font-body text-xs text-gray-400">
                {t('app.tagline')}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label={t('a11y.mainNav')} className="flex-1 px-3 py-2 flex flex-col gap-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-body font-semibold text-sm transition-colors focus-ring ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Invite friend card */}
        <div className="p-3">
          <div className="bg-primary-50 rounded-2xl p-4 flex flex-col items-center gap-3">
            {sentTo ? (
              <>
                <div className="text-3xl" aria-hidden="true">📬</div>
                <p className="font-body text-xs font-semibold text-primary-700 text-center">
                  {t('inviteParent.success', { email: sentTo })}
                </p>
                <Button variant="secondary" onClick={() => { setSentTo(null); setInviteOpen(false) }}>
                  {t('inviteParent.sendAnother')}
                </Button>
              </>
            ) : inviteOpen ? (
              <form
                noValidate
                onSubmit={handleInvite}
                className="flex flex-col gap-3 w-full"
                aria-label={t('inviteParent.title')}
                aria-busy={isLoading}
              >
                {inviteErrorKey && <FormAlert message={t(inviteErrorKey)} />}
                <FormField
                  id="invite-email"
                  label={t('inviteParent.email')}
                  type="email"
                  value={inviteEmail}
                  required
                  autoComplete="off"
                  disabled={isLoading}
                  error={fieldErrors.email}
                  onChange={e => { setInviteEmail(e.target.value); clearFieldError('email') }}
                />
                <FormField
                  id="invite-username-hint"
                  label={t('inviteParent.usernameHint')}
                  type="text"
                  dir="ltr"
                  value={usernameHint}
                  autoComplete="off"
                  disabled={isLoading}
                  onChange={e => setUsernameHint(e.target.value)}
                />
                <Button variant="primary" type="submit" disabled={isLoading}>
                  {isLoading ? t('inviteParent.sending') : t('inviteParent.submit')}
                </Button>
                <button
                  type="button"
                  className="font-body text-xs text-gray-400 hover:text-gray-600 focus-ring rounded"
                  onClick={() => setInviteOpen(false)}
                >
                  {t('auth.back')}
                </button>
              </form>
            ) : (
              <>
                <div className="text-3xl" aria-hidden="true">👥</div>
                <p className="font-body text-xs font-semibold text-primary-700 text-center">
                  {t('inviteParent.title')}
                </p>
                <p className="font-body text-xs text-gray-500 text-center">
                  {t('inviteParent.hint')}
                </p>
                <Button variant="primary" onClick={() => setInviteOpen(true)}>
                  {t('kidDash.inviteNow')}
                </Button>
              </>
            )}
          </div>
        </div>

      </aside>

      {/* ══ Main area ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 id="dashboard-heading" className="font-heading text-3xl font-bold text-gray-900">
              {t('dashboard.greeting', { name: currentUser?.username })} 👋
            </h1>
            <p className="font-body text-sm text-gray-400">{t('kidDash.readyToLevel')}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak */}
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-2">
              <span aria-hidden="true">🔥</span>
              <div>
                <div className="font-heading font-bold text-gray-900 text-sm leading-none">{MOCK_STREAK}</div>
                <div className="font-body text-xs text-gray-400">{t('kidDash.streak')}</div>
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-2">
              <span aria-hidden="true">⭐</span>
              <div>
                <div className="font-heading font-bold text-gray-900 text-sm leading-none">
                  {MOCK_POINTS.toLocaleString()}
                </div>
                <div className="font-body text-xs text-gray-400">{t('kidDash.points')}</div>
              </div>
            </div>

            {/* Avatar / logout */}
            <button
              type="button"
              onClick={() => { logout(); navigate('/') }}
              aria-label={t('nav.logout')}
              className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-heading font-bold text-primary-700 hover:bg-primary-200 focus-ring transition-colors"
            >
              {currentUser?.username?.[0]?.toUpperCase() ?? '?'}
            </button>
          </div>
        </header>

        {/* Content grid */}
        <main
          aria-labelledby="dashboard-heading"
          className="flex-1 p-6 grid grid-cols-3 gap-6 overflow-auto"
        >

          {/* ── Left column (spans 2) ─────────────────────────────────────── */}
          <div className="col-span-2 flex flex-col gap-6">

            {/* Hero card */}
            <div className="bg-primary-100 rounded-2xl p-6 flex items-center gap-6">
              {/* Character placeholder — replace with real character art later */}
              <div
                className="w-24 h-24 rounded-2xl bg-primary-200 flex items-center justify-center text-5xl shrink-0"
                aria-hidden="true"
              >
                🧒
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-primary-500 text-white font-heading font-bold text-sm px-3 py-1 rounded-full">
                    {t('kidDash.level', { level: MOCK_LEVEL })}
                  </span>
                  <span className="font-body text-sm text-primary-700">
                    {MOCK_XP} / {MOCK_XP_MAX} XP
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label="XP progress"
                  aria-valuenow={MOCK_XP}
                  aria-valuemin={0}
                  aria-valuemax={MOCK_XP_MAX}
                  className="h-4 bg-white rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${(MOCK_XP / MOCK_XP_MAX) * 100}%` }}
                  />
                </div>

                <p className="font-body text-sm text-primary-700 mt-3">
                  {t('kidDash.motivationHint')} 💪
                </p>
              </div>

              <div className="text-4xl shrink-0" aria-hidden="true">🎁</div>
            </div>

            {/* Task list */}
            <section aria-labelledby="tasks-heading" className="bg-white rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 id="tasks-heading" className="font-heading text-xl font-bold text-gray-900">
                    {t('kidDash.todaysTasks')}
                  </h2>
                  <span
                    className="bg-primary-500 text-white font-body font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center"
                    aria-label={`${tasks.length} tasks`}
                  >
                    {tasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="font-body text-sm font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded"
                >
                  {t('kidDash.viewAll')}
                </button>
              </div>

              <ul className="flex flex-col gap-2" aria-label={t('kidDash.todaysTasks')}>
                {tasks.map(task => {
                  const style = CATEGORY_STYLE[task.category]
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {/* Category icon */}
                      <div
                        className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center text-lg shrink-0`}
                        aria-hidden="true"
                      >
                        {style.icon}
                      </div>

                      {/* Title + category */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-body font-semibold text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        <p className={`font-body text-xs font-semibold mt-0.5 ${style.text}`}>
                          {t(`kidDash.categories.${task.category}`)}
                        </p>
                      </div>

                      {/* Points */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-body font-bold text-sm text-gray-700">+{task.points}</span>
                        <span aria-hidden="true">⭐</span>
                      </div>

                      {/* Checkbox */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={task.title}
                        onClick={() => toggleTask(task.id)}
                        className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center focus-ring transition-colors ${
                          task.completed
                            ? 'bg-teal-500 border-teal-500'
                            : 'border-gray-300 hover:border-primary-500'
                        }`}
                      >
                        {task.completed && (
                          <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none" aria-hidden="true">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                className="mt-4 w-full py-3 rounded-xl bg-primary-500 text-white font-body font-semibold text-sm hover:bg-primary-600 active:bg-primary-700 focus-ring transition-colors"
              >
                {t('kidDash.addTask')}
              </button>
            </section>

          </div>

          {/* ── Right column ──────────────────────────────────────────────── */}
          <div className="col-span-1 flex flex-col gap-4">

            {/* My Stats */}
            <section aria-labelledby="stats-heading" className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 id="stats-heading" className="font-heading text-lg font-bold text-gray-900">
                  {t('kidDash.myStats')}
                </h2>
                <button
                  type="button"
                  className="font-body text-xs font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded"
                >
                  {t('kidDash.details')}
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {MOCK_STATS.map(({ category, value }) => {
                  const style = CATEGORY_STYLE[category]
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true">{style.icon}</span>
                          <span className="font-body text-sm font-semibold text-gray-700">
                            {t(`kidDash.categories.${category}`)}
                          </span>
                        </div>
                        <span className="font-body text-xs text-gray-400">{value} / 100</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={t(`kidDash.categories.${category}`)}
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2 bg-gray-100 rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full ${style.bar} rounded-full`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* My Character — placeholder */}
            <section className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-heading text-lg font-bold text-gray-900">My Character</h2>
                <button type="button" className="font-body text-xs font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded">
                  Customize →
                </button>
              </div>
              <div className="flex justify-center py-4">
                <div className="text-6xl" aria-hidden="true">🧒</div>
              </div>
            </section>

            {/* Points — placeholder */}
            <section className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-heading text-lg font-bold text-gray-900">{t('kidDash.points')}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">⭐</span>
                <span className="font-heading text-3xl font-bold text-gray-900">
                  {MOCK_POINTS.toLocaleString()}
                </span>
              </div>
            </section>

          </div>

        </main>
      </div>
    </div>
  )
}
