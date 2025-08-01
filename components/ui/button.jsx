// components/ui/button.jsx
import React from 'react'

export function Button({ children, className = '', ...props }) {
  return (
    <button
      className={
        `px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 
         disabled:opacity-50 disabled:cursor-not-allowed ${className}`
      }
      {...props}
    >
      {children}
    </button>
  )
}
