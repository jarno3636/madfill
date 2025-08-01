// components/ui/card.jsx
import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white shadow rounded-lg ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`border-b px-4 py-2 text-lg font-semibold ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}
