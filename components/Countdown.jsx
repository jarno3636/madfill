// components/Countdown.jsx
import { useState, useEffect } from 'react'

export function Countdown({ targetTimestamp }) {
  const [remaining, setRemaining] = useState(() => Math.max(targetTimestamp - Math.floor(Date.now()/1000), 0))

  useEffect(() => {
    if (remaining <= 0) return
    const iv = setInterval(() => {
      setRemaining(r => {
        const next = r - 1
        return next >= 0 ? next : 0
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [remaining])

  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60

  return (
    <span>
      {hrs}h {mins}m {secs}s
    </span>
  )
}
