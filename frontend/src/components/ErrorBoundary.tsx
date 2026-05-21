import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import i18n from '../i18n/config'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-50"
        >
          <h1 className="font-heading text-2xl font-bold text-gray-900 text-center">
            {i18n.t('errors.boundary.title')}
          </h1>
          <p className="font-body text-gray-500 text-center max-w-sm px-4">
            {i18n.t('errors.boundary.message')}
          </p>
          <button
            type="button"
            className="font-body text-sm text-primary-600 underline focus-ring rounded-sm"
            onClick={() => this.setState({ hasError: false })}
          >
            {i18n.t('errors.boundary.retry')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
