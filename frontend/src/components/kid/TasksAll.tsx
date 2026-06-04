import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type Task, type TaskCategory, CATEGORY_STYLE, primaryCategory } from '../../constants/categories'
import { type CompletionInfo } from './TodaysTasks'

interface Props {
  tasks: Task[]
  completionInfo: Map<string, CompletionInfo>
  onComplete: (id: string) => void
  onClose: () => void
}

export default function TasksAll({ tasks, completionInfo, onComplete, onClose }: Props) {
  const { t } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  const [expandedIds, setExpandedIds] = useState(new Set<string>())

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!cardRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={cardRef} className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-heading text-xl font-bold text-gray-900">
            {t('kidDash.todaysTasks')}
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

        <ul className="overflow-y-auto flex flex-col divide-y divide-gray-50">
          {tasks.map(task => {
            const info      = completionInfo.get(task.id)
            const isDone    = info?.status === 'confirmed' || info?.status === 'pending'
            const isPending = info?.status === 'pending'
            const isRejected = info?.status === 'rejected'
            const category  = primaryCategory(task.category_rewards)
            const style     = CATEGORY_STYLE[category]
            const hasDetails = !!task.description || (task.ai_evaluated && !!task.ai_summary)
            const isExpanded = expandedIds.has(task.id)

            return (
              <li key={task.id} className="flex flex-col px-4 py-3">
                <div className="flex items-center gap-3">

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center text-lg shrink-0`} aria-hidden="true">
                    {style.icon}
                  </div>

                  {/* Title + category + expand toggle */}
                  <button
                    type="button"
                    onClick={() => hasDetails && toggleExpand(task.id)}
                    disabled={!hasDetails}
                    className="flex-1 min-w-0 text-left focus-ring rounded-lg disabled:cursor-default"
                  >
                    <p className={`font-body font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                      {hasDetails && (
                        <span className="ms-1 text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      )}
                    </p>
                    <p className={`font-body text-xs font-semibold mt-0.5 ${style.text}`}>
                      {t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)}
                    </p>
                  </button>

                  {/* Points */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-body font-bold text-sm text-gray-700">+{task.xp_reward}</span>
                    <span aria-hidden="true">⭐</span>
                  </div>

                  {/* Status indicator */}
                  {isPending ? (
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 text-amber-400" aria-label={t('kidDash.taskPending')}>
                      ⏳
                    </span>
                  ) : isDone ? (
                    <span className="w-7 h-7 rounded-full bg-teal-500 border-2 border-teal-500 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none" aria-hidden="true">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={false}
                      aria-label={task.title}
                      onClick={() => onComplete(task.id)}
                      className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-primary-500 shrink-0 flex items-center justify-center focus-ring transition-colors"
                    />
                  )}
                </div>

                {/* Rejection note */}
                {isRejected && (
                  <div className="ms-13 mt-1 ms-[3.25rem] flex flex-col gap-0.5">
                    <p className="font-body text-xs font-semibold text-danger-500">
                      ✗ {t('kidDash.taskRejected')}
                    </p>
                    {info?.review_note && (
                      <p className="font-body text-xs text-gray-500 italic">
                        "{info.review_note}"
                      </p>
                    )}
                  </div>
                )}

                {/* Expanded: description + AI summary */}
                {isExpanded && (
                  <div className="ms-[3.25rem] mt-2 flex flex-col gap-2">
                    {task.description && (
                      <p className="font-body text-xs text-gray-600 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                    {task.ai_evaluated && task.ai_summary && (
                      <div className="bg-primary-50 rounded-lg px-3 py-2">
                        <p className="font-body text-xs font-semibold text-primary-600 mb-0.5">
                          ✨ {t('kidDash.aiSummary')}
                        </p>
                        <p className="font-body text-xs text-primary-700 leading-relaxed">
                          {task.ai_summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

      </div>
    </div>
  )
}
