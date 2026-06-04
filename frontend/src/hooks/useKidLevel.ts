import { useQuery } from '@tanstack/react-query'
import { type TaskCategory } from '../constants/categories'
import { getTasks, getCompletions, type Completion } from '../api/tasks'

const CATEGORIES: TaskCategory[] = ['health', 'learning', 'responsibility', 'creativity']

export interface KidLevelData {
  /** XP earned per category (confirmed completions only) */
  earned: Record<TaskCategory, number>
  /** Sum of all category XP */
  totalXp: number
  /** Overall level: floor(totalXp / 100) + 1 */
  level: number
  /** XP progress within current overall level (0–99) */
  progress: number
  /** Consecutive days (ending today) with at least one confirmed completion */
  streak: number
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

export function useKidLevel(): KidLevelData {
  // Both served from TanStack Query cache — no extra requests
  const { data: tasks       = [] } = useQuery({ queryKey: ['tasks'],       queryFn: getTasks })
  const { data: completions = [] } = useQuery({ queryKey: ['completions'], queryFn: getCompletions })

  const taskMap = new Map(tasks.map(t => [t.id, t]))

  const earned = Object.fromEntries(
    CATEGORIES.map(cat => [cat, 0])
  ) as Record<TaskCategory, number>

  for (const completion of completions) {
    if (completion.status !== 'confirmed') continue
    const task = taskMap.get(completion.task)
    if (!task) continue
    for (const reward of task.category_rewards) {
      if (reward.category in earned) earned[reward.category as TaskCategory] += reward.points_value
    }
  }

  const totalXp  = Object.values(earned).reduce((a, b) => a + b, 0)
  const level    = Math.floor(totalXp / 100) + 1
  const progress = totalXp % 100
  const streak   = computeStreak(completions)

  return { earned, totalXp, level, progress, streak }
}
