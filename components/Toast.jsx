// components/Toast.jsx (formerly inline Toast context/component)
// If your file is named components/Toast.jsx or components/Toast/index.jsx, adjust imports accordingly.
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
} from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map()) // id -> timeoutId

  const clearTimer = useCallback((id) => {
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const removeToast = useCallback((id) => {
    clearTimer(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [clearTimer])

  const addToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      title: '',
      message: '',
      ...toast,
    }
    setToasts((prev) => [...prev, newToast])

    // Auto-remove
    const timeoutId = setTimeout(() => removeToast(id), newToast.duration)
    timersRef.current.set(id, timeoutId)

    return id
  }, [removeToast])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((tid) => clearTimeout(tid))
      timersRef.current.clear()
    }
  }, [])

  const value = { addToast, removeToast }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts?.length) return null
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-[calc(100%-2rem)] max-w-md">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

const TYPE_STYLES = {
  success: 'bg-green-500 text-white border-green-400/60',
  error: 'bg-red-500 text-white border-red-400/60',
  warning: 'bg-yellow-400 text-black border-yellow-300/70',
  info: 'bg-blue-500 text-white border-blue-400/60',
}

const TYPE_ICON = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const Toast = memo(function Toast({ toast, onRemove }) {
  const style =
    TYPE_STYLES[toast.type] || TYPE_STYLES.info
  const icon =
    TYPE_ICON[toast.type] || TYPE_ICON.info

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={[
        'px-4 py-3 rounded-xl shadow-lg border',
        'flex items-start gap-3',
        'backdrop-blur-sm',
        'transition-transform duration-200',
        'animate-[toast-in_180ms_ease-out]',
        style,
      ].join(' ')}
      style={{
        // simple keyframe shim if your Tailwind setup lacks animate utilities
        animationName: 'toast-in',
      }}
    >
      <span className="text-lg select-none">{icon}</span>
      <div className="min-w-0 flex-1">
        {toast.title ? (
          <div className="font-semibold leading-snug">{toast.title}</div>
        ) : null}
        {toast.message ? (
          <div className={`leading-snug ${toast.title ? 'text-sm opacity-90' : ''}`}>
            {toast.message}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="ml-2 text-xl leading-none hover:opacity-80 active:opacity-60 transition-opacity"
      >
        ×
      </button>

      {/* Inline keyframes fallback */}
      <style jsx>{`
        @keyframes toast-in {
          from { transform: translateX(16px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
})
