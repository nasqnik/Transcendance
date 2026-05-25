import { useTranslation } from 'react-i18next'
import { GoogleLogin } from '@react-oauth/google'

interface GoogleSignInSectionProps {
  onSuccess: (credential: string) => void
  onError?: () => void
  hint?: string
  disabled?: boolean
}

export default function GoogleSignInSection({
  onSuccess,
  onError,
  hint,
  disabled = false,
}: GoogleSignInSectionProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 w-80 max-w-full">
      <div className="flex items-center gap-3 w-full">
        <hr className="flex-1 border-gray-300" />
        <span className="font-body text-xs text-gray-400">{t('auth.orContinueWith')}</span>
        <hr className="flex-1 border-gray-300" />
      </div>
      <div
        className={`w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        aria-disabled={disabled || undefined}
      >
        <GoogleLogin
          key={i18n.language}
          onSuccess={credentialResponse => {
            if (disabled) return
            if (credentialResponse.credential) onSuccess(credentialResponse.credential)
          }}
          onError={() => onError?.()}
          width="100%"
        />
      </div>
      {hint && (
        <p className="font-body text-xs text-gray-500 text-center">{hint}</p>
      )}
    </div>
  )
}
