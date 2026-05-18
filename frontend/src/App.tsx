import { useTranslation } from 'react-i18next'
import { RTL_LANGUAGES } from './i18n/config'

export default function App() {
  const { t, i18n } = useTranslation()
  const isRTL = RTL_LANGUAGES.includes(i18n.language)

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex flex-col items-center justify-center h-screen gap-4 bg-primary-50">
      <h1 className="font-heading text-4xl font-bold text-primary-700">{t('app.name')}</h1>
      <p className="font-body text-gray-700">{t('landing.tagline')}</p>
      <div className="flex gap-2">
        <button onClick={() => i18n.changeLanguage('en')} className="font-body text-sm text-gray-700 underline">EN</button>
        <button onClick={() => i18n.changeLanguage('ru')} className="font-body text-sm text-gray-700 underline">RU</button>
        <button onClick={() => i18n.changeLanguage('ar')} className="font-body text-sm text-gray-700 underline">AR</button>
      </div>
    </div>
  )
}
