// components/ui/card.jsx
import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-lg shadow ${className}`} style={{ backgroundColor: 'rgba(15, 23, 42, 1)' }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`border-b px-4 py-2 text-lg font-semibold text-white ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-4 text-white ${className}`}>
      {children}
    </div>
  )
}
