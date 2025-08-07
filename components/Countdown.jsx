import { useState, useEffect } from 'react'

export function Countdown({ targetTimestamp }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(targetTimestamp - Math.floor(Date.now() / 1000), 0)
  )

  useEffect(() => {
    if (remaining <= 0) return
    const iv = setInterval(() => {
      setRemaining(r => Math.max(r - 1, 0))
    }, 1000)
    return () => clearInterval(iv)
  }, [remaining])

  const pad = n => n.toString().padStart(2, '0')
  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60

  if (remaining === 0) {
    return <span className="text-red-500 font-bold">⏰ Ended</span>
  }

  return (
    <span>
      {pad(hrs)}h {pad(mins)}m {pad(secs)}s
    </span>
  )
}
