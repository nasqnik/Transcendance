interface ButtonProps {
  children: React.ReactNode  // the text inside the button
  variant: 'primary' | 'secondary'
  onClick?: () => void       // optional click handler
}

export default function Button({ children, variant, onClick }: ButtonProps) {
  const styles = {
    primary: 'bg-primary-500 text-white',
    secondary: 'border-2 border-primary-500 text-primary-500',
  }

  return (
    <button
      className={`font-body font-semibold px-6 py-3 rounded-xl ${styles[variant]}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}