import { useQuery } from '@tanstack/react-query'
import { type TaskCategory } from '../constants/categories'
import { getCompletions, type Completion } from '../api/tasks'
import {
  getGamificationStats,
  getGamificationProfile,
} from '../api/gamification'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KidLevelData {
  /** Per-category level + XP progress, straight from the backend */
  stats: Record<TaskCategory, { level: number; xp_percent: number }>
  /** Kid's overall (main) level */
  level: number
  /** Progress within current main level as 0-100 percentage */
  progress: number
  /** Coins earned */
  coins: number
  /** Consecutive days (ending today, UTC) with ≥1 confirmed completion */
  streak: number
}

const CATEGORIES: TaskCategory[] = ['health', 'learning', 'responsibility', 'creativity']
const MAIN_XP_PER_LEVEL = 200  // must match backend MAIN_XP_PER_LEVEL setting

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyStats(): Record<TaskCategory, { level: number; xp_percent: number }> {
  return Object.fromEntries(
    CATEGORIES.map(cat => [cat, { level: 0, xp_percent: 0 }])
  ) as Record<TaskCategory, { level: number; xp_percent: number }>
}

function computeStreak(completions: Completion[]): number {
  const confirmedDates = new Set(
    completions
      .filter(c => c.status === 'confirmed')
      .map(c => c.completed_at.slice(0, 10))
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; ; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (confirmedDates.has(d.toISOString().slice(0, 10))) streak++
    else break
  }
  return streak
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKidLevel(): KidLevelData {
  // Gamification service — real server-side XP/level data
  const { data: rawStats   = [] } = useQuery({ queryKey: ['gamificationStats'],   queryFn: getGamificationStats })
  const { data: profile         } = useQuery({ queryKey: ['gamificationProfile'], queryFn: getGamificationProfile })
  // Completions already cached by TodaysTasks — no extra request
  const { data: completions = [] } = useQuery({ queryKey: ['completions'],        queryFn: getCompletions })

  // Build per-category map, defaulting to zeros for categories not yet started
  const stats = emptyStats()
  for (const s of rawStats) {
    if (s.category in stats) {
      stats[s.category as TaskCategory] = { level: s.level, xp_percent: s.xp_percent }
    }
  }

  const level    = profile?.main_level ?? 0
  // overall_xp is 0-(MAIN_XP_PER_LEVEL-1) within the current level
  const progress = profile ? Math.round((profile.overall_xp / MAIN_XP_PER_LEVEL) * 100) : 0
  const coins    = profile?.coins ?? 0
  const streak   = computeStreak(completions)

  return { stats, level, progress, coins, streak }
}
