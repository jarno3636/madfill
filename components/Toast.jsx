import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    const newToast = { 
      id, 
      type: 'info', 
      duration: 5000,
      ...toast 
    }
    
    setToasts(prev => [...prev, newToast])

    // Auto remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, newToast.duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  const typeStyles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-500 text-white'
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-lg max-w-md
        flex items-center justify-between
        animate-in slide-in-from-right-full
        ${typeStyles[toast.type] || typeStyles.info}
      `}
    >
      <div className="flex items-center space-x-3">
        <span className="text-lg">{icons[toast.type]}</span>
        <div>
          {toast.title && (
            <div className="font-semibold">{toast.title}</div>
          )}
          {toast.message && (
            <div className={toast.title ? 'text-sm opacity-90' : ''}>
              {toast.message}
            </div>
          )}
        </div>
      </div>
      
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-4 text-lg hover:opacity-70 transition-opacity"
      >
        ×
      </button>
    </div>
  )
}