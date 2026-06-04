import { useTranslation } from 'react-i18next'
import { type TaskCategory, CATEGORY_STYLE } from '../../constants/categories'

// ─── Mock data (replace with API call later) ──────────────────────────────────

const MOCK_STATS: { category: TaskCategory; value: number }[] = [
  { category: 'health',         value: 80 },
  { category: 'learning',       value: 70 },
  { category: 'responsibility', value: 60 },
  { category: 'honesty',        value: 90 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function KidStats() {
  const { t } = useTranslation()

  return (
    <section aria-labelledby="stats-heading" className="bg-white rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 id="stats-heading" className="font-heading text-lg font-bold text-gray-900">
          {t('kidDash.myStats')}
        </h2>
        <button
          type="button"
          className="font-body text-xs font-semibold text-primary-500 hover:text-primary-700 focus-ring rounded"
        >
          {t('kidDash.details')}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {MOCK_STATS.map(({ category, value }) => {
          const style = CATEGORY_STYLE[category]
          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{style.icon}</span>
                  <span className="font-body text-sm font-semibold text-gray-700">
                    {t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)}
                  </span>
                </div>
                <span className="font-body text-xs text-gray-400">{value} / 100</span>
              </div>
              <div
                role="progressbar"
                aria-label={t(`kidDash.categories.${category}` as `kidDash.categories.${TaskCategory}`)}
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 bg-gray-100 rounded-full overflow-hidden"
              >
                <div
                  className={`h-full ${style.bar} rounded-full`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
