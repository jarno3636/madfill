// tests/components/ErrorBoundary.test.jsx

import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../../components/ErrorBoundary'

// Component that throws during render to trigger the boundary
const Boom = ({ shouldError }) => {
  if (shouldError) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy

  beforeEach(() => {
    // Silence React error output for intentional throw in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldError={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldError />
      </ErrorBoundary>
    )

    // Be a bit flexible on copy but assert core affordances exist
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /home|homepage/i })
    ).toBeInTheDocument()
  })
})
