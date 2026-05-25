import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FormField from '../../components/FormField'

const defaultProps = {
  id: 'test-field',
  label: 'Test Label',
  value: '',
  onChange: vi.fn(),
}

describe('FormField', () => {
  it('renders label text', () => {
    render(<FormField {...defaultProps} />)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('label for attribute matches input id', () => {
    render(<FormField {...defaultProps} />)
    const label = screen.getByText('Test Label')
    expect(label).toHaveAttribute('for', 'test-field')
  })

  it('does not render a role="alert" element when no error prop', () => {
    render(<FormField {...defaultProps} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error text in role="alert" when error is provided', () => {
    render(<FormField {...defaultProps} error="This field is required" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This field is required')
  })

  it('input has aria-invalid="true" when error is provided', () => {
    render(<FormField {...defaultProps} error="This field is required" />)
    const input = screen.getByLabelText('Test Label')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('input does NOT have aria-invalid attribute when no error', () => {
    render(<FormField {...defaultProps} />)
    const input = screen.getByLabelText('Test Label')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('error element has id="${id}-error" and input has aria-describedby="${id}-error" when error provided', () => {
    render(<FormField {...defaultProps} error="Error message" />)
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveAttribute('id', 'test-field-error')

    const input = screen.getByLabelText('Test Label')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error')
  })

  it('input has no aria-describedby when no error', () => {
    render(<FormField {...defaultProps} />)
    const input = screen.getByLabelText('Test Label')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<FormField {...defaultProps} onChange={handleChange} />)
    const input = screen.getByLabelText('Test Label')
    await user.type(input, 'hello')
    expect(handleChange).toHaveBeenCalled()
  })
})
