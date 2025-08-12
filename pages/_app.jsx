import '../styles/globals.css'
import { useMiniAppReady } from '../hooks/useMiniAppReady'
import { useEffect } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import { ToastProvider } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'

function MyApp({ Component, pageProps }) {
  const { isReady, error } = useMiniAppReady()

  useEffect(() => {
    if (isReady) {
      console.log('Farcaster Mini App is ready')
    }
    if (error) {
      console.error('Mini App initialization error:', error)
    }
  }, [isReady, error])

  // Show loading state while Mini App is initializing
  if (!isReady && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <LoadingSpinner size="xl" text="Initializing MadFill..." />
        </div>
      </div>
    )
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md text-center">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-4">Failed to initialize Mini App</h2>
          <p className="text-purple-200 mb-6">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default MyApp