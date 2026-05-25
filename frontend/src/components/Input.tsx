interface InputProps {
  id: string
  name?: string
  type?: 'email' | 'password' | 'text'
  value: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  error?: string
  describedBy?: string
  /** Force text direction — use "ltr" for fields that always contain ASCII (username, email identifier). */
  dir?: 'ltr' | 'rtl'
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Input({
  id,
  name,
  type,
  value,
  placeholder,
  required,
  autoComplete,
  error,
  describedBy,
  dir,
  onChange,
}: InputProps) {
  const hasError = Boolean(error)

  return (
    <input
      id={id}
      name={name ?? id}
      type={type}
      dir={dir ?? (type === 'email' ? 'ltr' : undefined)}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      required={required}
      autoComplete={autoComplete}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={`font-body w-full px-4 py-3 rounded-xl border-2 focus-ring focus-visible:border-primary-500 ${
        hasError ? 'border-danger-500' : 'border-gray-200'
      }`}
    />
  )
}