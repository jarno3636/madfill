import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 flex items-center justify-center p-4">
      <div className="bg-slate-900/80 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700">
        <div className="text-6xl mb-4">🚨</div>
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
        <p className="text-slate-300 mb-6">
          We encountered an unexpected error. Please try refreshing the page.
        </p>
        <div className="space-y-3">
          <button
            onClick={resetErrorBoundary}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to homepage
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-slate-400 cursor-pointer">Error details</summary>
            <pre className="mt-2 text-xs text-red-400 bg-slate-800 p-3 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ErrorBoundary({ children }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
        // Send to error reporting service
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'exception', {
            description: error.toString(),
            fatal: false,
          });
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}