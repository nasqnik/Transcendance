import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  usePageTitle(`${t('notFound.title')} — ${t('app.name')}`)

  return (
    <main
      aria-labelledby="not-found-heading"
      className="flex flex-col items-center justify-center min-h-screen bg-primary-50 gap-6 py-12"
    >
      <h1 id="not-found-heading" className="font-heading text-3xl font-bold text-primary-700 text-center">
        {t('notFound.title')}
      </h1>
      <p className="font-body text-sm text-gray-700 text-center max-w-sm px-4">
        {t('notFound.message')}
      </p>
      <Button variant="primary" onClick={() => navigate('/')}>
        {t('notFound.backHome')}
      </Button>
      <LanguageSwitcher />
    </main>
  )
}
