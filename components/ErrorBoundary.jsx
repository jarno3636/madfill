// components/ErrorBoundary.jsx
import React from 'react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }) {
  // Avoid rendering huge stacks; show message prominently, stack only in dev.
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 flex items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
      data-testid="error-fallback"
    >
      <div className="bg-slate-900/80 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700 shadow-xl">
        <div className="text-6xl mb-4" aria-hidden="true">🚨</div>
        <h2 className="text-2xl font-bold text-white mb-4">
          Something went wrong
        </h2>
        <p className="text-slate-300 mb-6">
          We hit an unexpected error. You can try again or head back home.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={resetErrorBoundary}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              // Only runs on client
              if (typeof window !== 'undefined') window.location.href = '/'
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Go to homepage
          </button>
        </div>

        {isDev && (
          <details className="mt-6 text-left open:text-slate-200">
            <summary className="text-slate-400 cursor-pointer select-none">
              Error details (dev)
            </summary>
            <pre className="mt-2 text-xs text-red-400 bg-slate-800 p-3 rounded overflow-auto max-h-64">
              {(error?.message || 'Unknown error')}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export default function ErrorBoundary({ children }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        // Log to console for quick visibility in dev and CI
        // errorInfo?.componentStack is a string of the component trace
        // eslint-disable-next-line no-console
        console.error('Error caught by boundary:', error, errorInfo)

        // Best-effort analytics without breaking SSR
        try {
          if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            const description = [
              error?.toString?.() || 'Unknown error',
              (errorInfo?.componentStack ? `\n${errorInfo.componentStack}` : ''),
            ].join('')
            window.gtag('event', 'exception', { description, fatal: false })
          }
        } catch {
          // no-op: never let analytics throw
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}
