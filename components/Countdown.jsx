import { useState, useEffect } from 'react'

export function Countdown({ targetTimestamp, onExpire = () => {} }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(targetTimestamp - Math.floor(Date.now() / 1000), 0)
  )
  const [expired, setExpired] = useState(remaining === 0)

  useEffect(() => {
    if (remaining <= 0) {
      setExpired(true)
      onExpire()
      return
    }

    const iv = setInterval(() => {
      setRemaining(r => {
        const next = r - 1
        if (next <= 0) {
          clearInterval(iv)
          setExpired(true)
          onExpire()
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(iv)
  }, [remaining, onExpire])

  const pad = n => n.toString().padStart(2, '0')
  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60

  const color =
    remaining > 3600
      ? 'text-green-400'
      : remaining > 300
      ? 'text-yellow-300'
      : 'text-red-500'

  if (expired) {
    return (
      <span className="text-red-500 font-bold animate-bounce">
        ⏰ Ended
      </span>
    )
  }

  return (
    <span className={`${color} font-mono font-semibold`}>
      ⏳ Live — {pad(hrs)}h {pad(mins)}m {pad(secs)}s
    </span>
  )
}
