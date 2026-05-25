import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../../components/Button'

describe('Button', () => {
  it('renders children text', () => {
    render(<Button variant="primary">Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button variant="primary" onClick={handleClick}>
        Click me
      </Button>
    )
    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('does NOT call onClick when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button variant="primary" onClick={handleClick} disabled>
        Click me
      </Button>
    )
    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders as type="submit" when specified', () => {
    render(
      <Button variant="primary" type="submit">
        Submit
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
  })

  it('defaults to type="button"', () => {
    render(<Button variant="primary">Do something</Button>)
    expect(screen.getByRole('button', { name: 'Do something' })).toHaveAttribute('type', 'button')
  })

  it('is disabled when disabled prop is provided', () => {
    render(
      <Button variant="primary" disabled>
        Disabled
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  it('uses aria-label as accessible name', () => {
    render(
      <Button variant="primary" aria-label="Close">
        ×
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
