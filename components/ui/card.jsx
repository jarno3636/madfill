// components/ui/card.jsx
import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-lg shadow ${className}`.trim()}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`border-b px-4 py-2 text-lg font-semibold ${className}`.trim()}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-4 ${className}`.trim()}>
      {children}
    </div>
  )
}
