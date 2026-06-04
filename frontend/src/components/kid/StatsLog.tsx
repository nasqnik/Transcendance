import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { type TaskCategory, CATEGORY_STYLE } from '../../constants/categories'
import { getTasks, getCompletions } from '../../api/tasks'

interface Props {
  onClose: () => void
}

export default function StatsLog({ onClose }: Props) {
  const { t, i18n } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)

  // Both served from cache — no extra requests
  const { data: tasks       = [] } = useQuery({ queryKey: ['tasks'],       queryFn: getTasks })
  const { data: completions = [] } = useQuery({ queryKey: ['completions'], queryFn: getCompletions })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!cardRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const taskMap = new Map(tasks.map(task => [task.id, task]))

  const log = completions
    .filter(c => c.status !== 'rejected')
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={cardRef} className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-heading text-xl font-bold text-gray-900">
            {t('kidDash.pointsLog')}
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

        {/* List */}
        {log.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <span className="text-4xl" aria-hidden="true">📭</span>
            <p className="font-body text-sm text-gray-400">{t('kidDash.noPointsLog')}</p>
          </div>
        ) : (
          <ul className="overflow-y-auto flex flex-col divide-y divide-gray-50">
            {log.map(completion => {
              const task = taskMap.get(completion.task)
              if (!task) return null

              const date = new Date(completion.completed_at).toLocaleDateString(
                i18n.language,
                { day: 'numeric', month: 'short' }
              )

              return (
                <li key={completion.id} className="flex items-center gap-3 px-6 py-3">

                  {/* Title + date */}
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm text-gray-900 truncate">
                      {task.title}
                    </p>
                    <p className="font-body text-xs text-gray-400 mt-0.5">{date}</p>
                  </div>

                  {/* Points breakdown per category */}
                  <div className="flex items-center gap-2 shrink-0">
                    {task.category_rewards.map(reward => (
                      <span
                        key={reward.category}
                        className={`font-body text-xs font-bold ${CATEGORY_STYLE[reward.category as TaskCategory]?.text ?? 'text-gray-500'}`}
                      >
                        +{reward.points_value} {CATEGORY_STYLE[reward.category as TaskCategory]?.icon}
                      </span>
                    ))}
                  </div>

                  {/* Status */}
                  {completion.status === 'confirmed' ? (
                    <span className="text-teal-500 text-base shrink-0" aria-label="Confirmed">✓</span>
                  ) : (
                    <span className="text-amber-400 text-base shrink-0" aria-label="Pending review">⏳</span>
                  )}

                </li>
              )
            })}
          </ul>
        )}

      </div>
    </div>
  )
}
