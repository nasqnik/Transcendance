import { useTranslation } from 'react-i18next'
import { useRef, useEffect } from 'react'
import { type Task, type TaskCategory, CATEGORY_STYLE } from '../../constants/categories'

interface Props {
    tasks: Task[]
    onToggle: (id : string) => void
    onClose: () => void
}

export default function TasksAll({ tasks, onToggle, onClose } : Props) {

    const { t } = useTranslation()
    const cardRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (!cardRef.current?.contains(e.target as Node)) onClose()
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

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

                <ul className="overflow-y-auto flex flex-col gap-1 p-4">
                    {tasks.map(task => {
                        const style = CATEGORY_STYLE[task.category]
                        return (
                            <li key={task.id} className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">

                                <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center text-lg shrink-0`} aria-hidden="true">
                                    {style.icon}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className={`font-body font-semibold text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                        {task.title}
                                    </p>
                                    <p className={`font-body text-xs font-semibold mt-0.5 ${style.text}`}>
                                        {t(`kidDash.categories.${task.category}` as `kidDash.categories.${TaskCategory}`)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="font-body font-bold text-sm text-gray-700">+{task.points}</span>
                                    <span aria-hidden="true">⭐</span>
                                </div>

                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={task.completed}
                                    aria-label={task.title}
                                    onClick={() => onToggle(task.id)}
                                    className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center focus-ring transition-colors ${
                                        task.completed ? 'bg-teal-500 border-teal-500' : 'border-gray-300 hover:border-primary-500'
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
            </div>
        </div>
    )
}