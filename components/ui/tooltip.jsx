// components/ui/tooltip.jsx
import { useState } from 'react'

export function Tooltip({ children, text }) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 rounded bg-slate-800 text-white text-xs shadow-lg whitespace-nowrap transition-all">
          {text}
        </div>
      )}
    </span>
  )
}
