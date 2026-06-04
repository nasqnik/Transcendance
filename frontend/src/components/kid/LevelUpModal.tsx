import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type TaskCategory, CATEGORY_STYLE } from '../../constants/categories'

interface Props {
  category: TaskCategory
  level: number
  onClose: () => void
}

export default function LevelUpModal({ category, level, onClose }: Props) {
  const { t } = useTranslation()
  const style = CATEGORY_STYLE[category]

  // Auto-close after 3 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const categoryLabel = t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-xs mx-4 p-8 flex flex-col items-center gap-4 text-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Big icon */}
        <div className={`w-20 h-20 rounded-2xl ${style.bg} flex items-center justify-center text-4xl`} aria-hidden="true">
          {style.icon}
        </div>

        {/* Level badge */}
        <div className={`px-4 py-1 rounded-full ${style.bg} ${style.text} font-body font-bold text-sm`}>
          {t('kidDash.level', { level })}
        </div>

        {/* Title */}
        <div>
          <p className="font-heading text-2xl font-bold text-gray-900">
            {t('kidDash.levelUp')} 🎉
          </p>
          <p className="font-body text-sm text-gray-500 mt-1">
            {t('kidDash.levelUpHint', { level, category: categoryLabel })}
          </p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className={`mt-2 w-full py-3 rounded-xl font-body font-semibold text-sm text-white focus-ring transition-colors ${style.bar}`}
        >
          🚀 {t('kidDash.letsGo')}
        </button>
      </div>
    </div>
  )
}
