import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Task, type TaskCategory, CATEGORY_STYLE, primaryCategory } from '../../constants/categories'
import { getTasks, getCompletions, postCompletion } from '../../api/tasks'
import TasksAll from './TasksAll'
import AddTaskModal from './AddTaskModal'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompletionInfo {
  status: 'pending' | 'confirmed' | 'rejected'
  review_note: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  completionInfo?: CompletionInfo
  onComplete: (id: string) => void
}

function TaskRow({ task, completionInfo, onComplete }: TaskRowProps) {
  const { t } = useTranslation()
  const category = primaryCategory(task.category_rewards)
  const style = CATEGORY_STYLE[category]
  const isDone     = completionInfo?.status === 'confirmed' || completionInfo?.status === 'pending'
  const isRejected = completionInfo?.status === 'rejected'

  return (
    <li className="flex flex-col gap-1 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">

        {/* Category icon */}
        <div
          className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center text-lg shrink-0`}
          aria-hidden="true"
        >
          {style.icon}
        </div>

        {/* Title + category */}
        <div className="flex-1 min-w-0">
          <p className={`font-body font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {task.title}
          </p>
          <p className={`font-body text-xs font-semibold mt-0.5 ${style.text}`}>
            {t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)}
          </p>
        </div>

        {/* Points */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-body font-bold text-sm text-gray-700">+{task.xp_reward}</span>
          <span aria-hidden="true">⭐</span>
        </div>

        {/* Checkbox / status */}
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={task.title}
          onClick={() => !isDone && !isRejected && onComplete(task.id)}
          disabled={isDone}
          className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center focus-ring transition-colors ${
            isDone
              ? 'bg-teal-500 border-teal-500'
              : 'border-gray-300 hover:border-primary-500'
          }`}
        >
          {isDone && (
            <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none" aria-hidden="true">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Rejection note */}
      {isRejected && (
        <div className="ms-14 flex flex-col gap-0.5">
          <p className="font-body text-xs font-semibold text-danger-500">
            ✗ {t('kidDash.taskRejected')}
          </p>
          {completionInfo?.review_note && (
            <p className="font-body text-xs text-gray-500 italic">
              "{completionInfo.review_note}"
            </p>
          )}
        </div>
      )}
    </li>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodaysTasks() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [viewAllOpen, setViewAllOpen] = useState(false)
  const [addOpen, setAddOpen]         = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const { data: tasks       = [], isLoading: tasksLoading       } = useQuery({ queryKey: ['tasks'],       queryFn: getTasks })
  const { data: completions = [], isLoading: completionsLoading } = useQuery({ queryKey: ['completions'], queryFn: getCompletions })

  const { mutate: complete } = useMutation({
    mutationFn: postCompletion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['completions'] }),
  })

  const isLoading = tasksLoading || completionsLoading

  // Most recent completion per task
  const completionInfo = new Map<string, CompletionInfo>()
  const sorted = [...completions].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  )
  for (const c of sorted) {
    if (!completionInfo.has(c.task)) {
      completionInfo.set(c.task, { status: c.status, review_note: c.review_note })
    }
  }

  // pending + confirmed = done (hide from main list); rejected = show again
  const completedIds = new Set(
    completions
      .filter(c => c.status === 'pending' || c.status === 'confirmed')
      .map(c => c.task)
  )

  const todaysTasks  = tasks.filter(task => task.due_date === today)
  const pendingTasks = todaysTasks.filter(task => !completedIds.has(task.id))

  return (
    <>
      <section aria-labelledby="tasks-heading" className="bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 id="tasks-heading" className="font-heading text-xl font-bold text-gray-900">
              {t('kidDash.todaysTasks')}
            </h2>
            {!isLoading && (
              <span
                className="bg-primary-500 text-white font-body font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center"
                aria-label={`${pendingTasks.length} tasks remaining`}
              >
                {pendingTasks.length}
              </span>
            )}
          </div>
          {todaysTasks.length > 0 && (
            <button
              type="button"
              className="font-body text-sm font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded"
              onClick={() => setViewAllOpen(true)}
            >
              {t('kidDash.viewAll')}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="font-body text-sm text-gray-400">{t('tasks.loading')}</p>
          </div>
        ) : todaysTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-5xl" aria-hidden="true">📋</span>
            <p className="font-heading font-bold text-gray-900">{t('kidDash.noTasks')}</p>
            <p className="font-body text-sm text-gray-400">{t('kidDash.noTasksHint')}</p>
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-5xl" aria-hidden="true">🎉</span>
            <p className="font-heading font-bold text-gray-900">{t('kidDash.allDone')}</p>
            <p className="font-body text-sm text-gray-400">{t('kidDash.allDoneHint')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={t('kidDash.todaysTasks')}>
            {pendingTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                completionInfo={completionInfo.get(task.id)}
                onComplete={complete}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-4 w-full py-3 rounded-xl bg-primary-500 text-white font-body font-semibold text-sm hover:bg-primary-600 active:bg-primary-700 focus-ring transition-colors"
        >
          {t('kidDash.addTask')}
        </button>
      </section>

      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} />}

      {viewAllOpen && (
        <TasksAll
          tasks={todaysTasks}
          completionInfo={completionInfo}
          onComplete={complete}
          onClose={() => setViewAllOpen(false)}
        />
      )}
    </>
  )
}
