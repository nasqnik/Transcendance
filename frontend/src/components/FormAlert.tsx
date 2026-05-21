interface FormAlertProps {
  message: string
}

export default function FormAlert({ message }: FormAlertProps) {
  return (
    <p role="alert" className="alert-error font-body text-sm text-center rounded-xl px-4 py-3">
      {message}
    </p>
  )
}
