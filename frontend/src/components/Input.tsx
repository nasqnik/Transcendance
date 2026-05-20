interface InputProps {
  id: string,       // "email" or "password"
  type?: 'email' | 'password' | 'text',
  value: string,
  placeholder: string,
  required?: boolean,
  autoComplete?: string,
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Input({ id, type, value, placeholder, required, autoComplete, onChange}: InputProps) {
    return (
        <input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            required={required}
            autoComplete={autoComplete}
            className="font-body px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-primary-500"
          />
    )
}