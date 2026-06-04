import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Task, type TaskCategory, CATEGORY_STYLE } from '../../constants/categories'
import TasksAll from './TasksAll'

// ─── Mock data (replace with API call later) ──────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Play soccer for 30 minutes', category: 'health',         points: 20, completed: true,  date: TODAY },
  { id: '2', title: 'Read for 20 minutes',         category: 'learning',       points: 15, completed: true,  date: TODAY },
  { id: '3', title: 'Make my bed',                 category: 'responsibility', points: 10, completed: false, date: TODAY },
  { id: '4', title: 'Drink 6 glasses of water',    category: 'health',         points: 10, completed: false, date: TODAY },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  onToggle: (id: string) => void
}

function TaskRow({ task, onToggle }: TaskRowProps) {
  const { t } = useTranslation()
  const style = CATEGORY_STYLE[task.category]

  return (
    <li className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">

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
          {t(`kidDash.categories.${task.category}` as `kidDash.categories.${TaskCategory}`)}
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
        onClick={() => onToggle(task.id)}
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodaysTasks() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const today = new Date().toISOString().slice(0, 10)
  const todaysTasks  = tasks.filter(task => task.date === today)
  const pendingTasks = todaysTasks.filter(task => !task.completed)
  const [viewAllOpen, setViewAllOpen] = useState(false)

  function toggleTask(id: string) {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  return (
    <>
    <section aria-labelledby="tasks-heading" className="bg-white rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 id="tasks-heading" className="font-heading text-xl font-bold text-gray-900">
            {t('kidDash.todaysTasks')}
          </h2>
          <span
            className="bg-primary-500 text-white font-body font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center"
            aria-label={`${pendingTasks.length} tasks remaining`}
          >
            {pendingTasks.length}
          </span>
        </div>
        <button
          type="button"
          className="font-body text-sm font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded"
          onClick={() => setViewAllOpen(true)}
        >
          {t('kidDash.viewAll')}
        </button>
      </div>

      {todaysTasks.length === 0 ? (
        /* no tasks assigned today at all */
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-5xl" aria-hidden="true">📋</span>
          <p className="font-heading font-bold text-gray-900">{t('kidDash.noTasks')}</p>
          <p className="font-body text-sm text-gray-400">{t('kidDash.noTasksHint')}</p>
        </div>
      ) : pendingTasks.length === 0 ? (
        /* tasks exist but all completed */
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-5xl" aria-hidden="true">🎉</span>
          <p className="font-heading font-bold text-gray-900">{t('kidDash.allDone')}</p>
          <p className="font-body text-sm text-gray-400">{t('kidDash.allDoneHint')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('kidDash.todaysTasks')}>
          {pendingTasks.map(task => (
            <TaskRow key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </ul>
      )}

      <button
        type="button"
        className="mt-4 w-full py-3 rounded-xl bg-primary-500 text-white font-body font-semibold text-sm hover:bg-primary-600 active:bg-primary-700 focus-ring transition-colors"
      >
        {t('kidDash.addTask')}
      </button>
    </section>
    { viewAllOpen && (
      <TasksAll
        tasks={todaysTasks}
        onToggle={toggleTask}
        onClose={() => setViewAllOpen(false)}
      />
    )}
    </>
  )
}
