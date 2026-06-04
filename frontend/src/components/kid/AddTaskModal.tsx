import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, type CreateTaskInput } from '../../api/tasks'
import { type Task } from '../../constants/categories'

interface Props {
  onClose: () => void
}

export default function AddTaskModal({ onClose }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const cardRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(today)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!cardRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const { mutate, isPending, isError } = useMutation({
    mutationFn: createTask,
    onMutate: async (input: CreateTaskInput) => {
      // Cancel in-flight task fetches so they don't overwrite our optimistic entry
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const prev = queryClient.getQueryData<Task[]>(['tasks'])

      // Add a placeholder task immediately — AI categories fill in after the API responds
      queryClient.setQueryData<Task[]>(['tasks'], old => [
        ...(old ?? []),
        {
          id: `optimistic-${Date.now()}`,
          kid_id: '',
          title: input.title,
          description: input.description,
          xp_reward: 0,
          ai_summary: '',
          ai_evaluated: false,
          due_date: input.due_date,
          is_active: true,
          created_at: new Date().toISOString(),
          category_rewards: [],
          review_mode: 'always',
        },
      ])
      return { prev }
    },
    onError: (_err, _input, context) => {
      // Roll back on failure
      queryClient.setQueryData(['tasks'], context?.prev)
    },
    onSettled: () => {
      // Always sync with server once the request resolves
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onSuccess: () => {
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    mutate({
      title: title.trim(),
      description: description.trim(),
      due_date: dueDate || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={cardRef} className="bg-white rounded-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-heading text-xl font-bold text-gray-900">
            {t('tasks.createTask')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 focus-ring transition-colors text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="task-title" className="font-body text-sm font-semibold text-gray-700">
              {t('tasks.title')}
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-body text-sm text-gray-900 placeholder-gray-400 focus-ring outline-none"
              placeholder={t('tasks.title')}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="task-description" className="font-body text-sm font-semibold text-gray-700">
              {t('tasks.description')}
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-body text-sm text-gray-900 placeholder-gray-400 focus-ring outline-none resize-none"
              placeholder={t('tasks.description')}
            />
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="task-due-date" className="font-body text-sm font-semibold text-gray-700">
              {t('tasks.dueDateLabel')}
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              min={today}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-body text-sm text-gray-900 focus-ring outline-none"
            />
          </div>

          {/* AI hint */}
          <p className="font-body text-xs text-gray-400">
            ✨ {t('tasks.aiHint')}
          </p>

          {/* Error */}
          {isError && (
            <p role="alert" className="font-body text-sm text-danger-500">
              {t('errors.generic')}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || isPending}
            className="w-full py-3 rounded-xl bg-primary-500 text-white font-body font-semibold text-sm hover:bg-primary-600 active:bg-primary-700 focus-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? t('tasks.creating') : t('tasks.createTaskSubmit')}
          </button>

        </form>
      </div>
    </div>
  )
}
