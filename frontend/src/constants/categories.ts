export type TaskCategory = 'health' | 'learning' | 'responsibility' | 'creativity'

export interface CategoryReward {
  category: TaskCategory
  points_value: number
}

export interface Task {
  id: string
  kid_id: string
  title: string
  description: string
  xp_reward: number
  ai_summary: string
  ai_evaluated: boolean
  due_date: string | null
  is_active: boolean
  created_at: string
  category_rewards: CategoryReward[]
  review_mode: 'always' | 'never' | 'optional'
}

export interface Completion {
  id: string
  task: string              // task id
  kid_id: string
  status: 'pending' | 'confirmed' | 'rejected'
  completed_at: string
  reviewed_at: string | null
  review_note: string
}

export const CATEGORY_STYLE: Record<TaskCategory, { bg: string; text: string; bar: string; icon: string }> = {
  health:         { bg: 'bg-teal-50',    text: 'text-teal-500',    bar: 'bg-teal-500',    icon: '❤️' },
  learning:       { bg: 'bg-blue-50',    text: 'text-blue-500',    bar: 'bg-blue-500',    icon: '📘' },
  responsibility: { bg: 'bg-amber-50',   text: 'text-amber-500',   bar: 'bg-amber-500',   icon: '🏆' },
  creativity:     { bg: 'bg-primary-50', text: 'text-primary-500', bar: 'bg-primary-500', icon: '🎨' },
}

/** Returns the category with the highest points_value, used as the display category. */
export function primaryCategory(rewards: CategoryReward[]): TaskCategory {
  if (!rewards.length) return 'learning'
  return [...rewards].sort((a, b) => b.points_value - a.points_value)[0].category
}
