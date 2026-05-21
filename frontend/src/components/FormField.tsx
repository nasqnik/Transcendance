import Input from './Input'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  type?: 'email' | 'password' | 'text'
  value: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function FormField({
  id,
  label,
  error,
  onChange,
  ...inputProps
}: FormFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-body text-sm font-semibold text-gray-700">
        {label}
      </label>
      <Input
        id={id}
        error={error}
        describedBy={error ? errorId : undefined}
        onChange={onChange}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
