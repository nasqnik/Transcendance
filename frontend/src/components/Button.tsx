interface ButtonProps {
  children: React.ReactNode
  variant: 'primary' | 'secondary'
  onClick?: () => void
  type?: 'button' | 'submit'
}

export default function Button({ children, variant, onClick, type = 'button' }: ButtonProps) {
  const styles = {
    primary: 'bg-primary-500 text-white',
    secondary: 'border-2 border-primary-500 text-primary-500',
  }

  return (
    <button
      type={type}
      className={`font-body font-semibold px-6 py-3 rounded-xl ${styles[variant]}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}