import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-[1.01] ${className}`}
    >
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
