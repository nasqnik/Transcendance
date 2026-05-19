import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'ar', label: 'AR' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex gap-3">
      {LANGUAGES.map(lang => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`font-body text-sm font-semibold px-3 py-1 rounded-lg ${
            i18n.language === lang.code
              ? 'bg-primary-500 text-white'
              : 'text-gray-500'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}