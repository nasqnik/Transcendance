import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/Button'
import Input from '../components/Input'

export default function Signup() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    // API call will go here later
    navigate('/dashboard')
  }

  return (
    <main className="flex flex-col items-center justify-center h-screen bg-primary-50 gap-6">
      <h1 className="font-heading text-3xl font-bold text-primary-700">{t('auth.signup')}</h1>
      <form className="flex flex-col gap-4 w-80" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="font-body text-sm font-semibold text-gray-700">
            {t('auth.name')}
          </label>
          <Input
            id="name"
            type="text"
            value={name}
            placeholder={t('auth.name')}
            required
            autoComplete="name"
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-body text-sm font-semibold text-gray-700">
            {t('auth.email')}
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            placeholder={t('auth.email')}
            required
            autoComplete="email"
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="font-body text-sm font-semibold text-gray-700">
            {t('auth.password')}
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            placeholder={t('auth.password')}
            required
            autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <Button variant="primary" type="submit">{t('auth.signup')}</Button>
      </form>
      <LanguageSwitcher />
    </main>
  )
}
