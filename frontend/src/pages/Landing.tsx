import Button from '../components/Button'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Landing() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  usePageTitle(t('app.name'))

  return (
    <main aria-labelledby="landing-heading" className="flex flex-col items-center justify-center h-screen bg-primary-50 gap-6">
      <h1 id="landing-heading" className="font-heading text-5xl font-bold text-primary-700 text-center">
        {t('app.name')}
      </h1>
      <p className="font-body text-lg text-gray-700 text-center">{t('landing.tagline')}</p>
      <div className="flex gap-4">
        <Button variant="primary" onClick={() => navigate('/login')}>{t('nav.login')}</Button>
        <Button variant="secondary" onClick={() => navigate('/signup')}>{t('nav.signup')}</Button>
      </div>
      <LanguageSwitcher />
    </main>
  )
}
