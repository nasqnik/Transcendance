import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'ar', label: 'AR' },
]

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const activeLang = i18n.resolvedLanguage ?? i18n.language

  return (
    <div
      role="group"
      aria-label={t('a11y.languageSwitcher')}
      className="flex gap-3"
    >
      {LANGUAGES.map(lang => {
        const isActive = activeLang === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => {
              i18n.changeLanguage(lang.code)
              localStorage.setItem('language', lang.code)
            }}
            aria-label={t('a11y.switchLanguage', { language: lang.label })}
            aria-pressed={isActive}
            className={`font-body text-sm font-semibold px-3 py-1 rounded-lg focus-ring ${
              isActive
                ? 'bg-primary-500 text-white'
                : 'text-gray-500'
            }`}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}