export type TaskCategory = 'health' | 'learning' | 'responsibility' | 'honesty'

export interface Task {
  id: string
  title: string
  category: TaskCategory
  points: number
  completed: boolean
  date: string   // ISO date string — "YYYY-MM-DD"
}

export const CATEGORY_STYLE: Record<TaskCategory, { bg: string; text: string; bar: string; icon: string }> = {
  health:         { bg: 'bg-teal-50',    text: 'text-teal-500',    bar: 'bg-teal-500',    icon: '❤️' },
  learning:       { bg: 'bg-blue-50',    text: 'text-blue-500',    bar: 'bg-blue-500',    icon: '📘' },
  responsibility: { bg: 'bg-amber-50',   text: 'text-amber-500',   bar: 'bg-amber-500',   icon: '🏆' },
  honesty:        { bg: 'bg-primary-50', text: 'text-primary-500', bar: 'bg-primary-500', icon: '🛡️' },
}
