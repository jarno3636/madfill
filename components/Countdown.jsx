// components/Countdown.jsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function Countdown({
  targetTimestamp,           // seconds since epoch
  onExpire = () => {},
  onTick,                    // optional: (remainingSeconds) => void
  className = '',
  showLabel = true,          // "⏳ Live — " prefix
  compact = false,           // true => 2:03:04:05, false => 2d 03h 04m 05s
  padHours = true,           // pad hours to 2 digits when days > 0
  warnAtSeconds = 3600,      // green -> yellow threshold (default 1h)
  dangerAtSeconds = 300,     // yellow -> red threshold (default 5m)
  endedBounce = true,        // bounce "Ended"
}) {
  // compute remaining from "now"
  const calcRemaining = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    return Math.max((Number(targetTimestamp) || 0) - now, 0)
  }, [targetTimestamp])

  const [remaining, setRemaining] = useState(calcRemaining)
  const [expired, setExpired] = useState(() => remaining === 0)
  const timerRef = useRef(null)

  // Recompute immediately if props change
  useEffect(() => {
    const r = calcRemaining()
    setRemaining(r)
    setExpired(r === 0)
  }, [calcRemaining])

  // Zero-drift ticking: schedule the next tick exactly at the next whole second
  useEffect(() => {
    if (remaining <= 0) {
      if (!expired) {
        setExpired(true)
        try { onExpire?.() } catch {}
      }
      return
    }

    // Call onTick if provided
    try { onTick?.(remaining) } catch {}

    // Clear any previous timer
    if (timerRef.current) clearTimeout(timerRef.current)

    // Compute ms until the next exact second boundary
    const nowMs = Date.now()
    const nextMs = Math.ceil(nowMs / 1000) * 1000
    const delay = Math.max(nextMs - nowMs, 0)

    timerRef.current = setTimeout(() => {
      setRemaining((r) => Math.max(r - 1, 0))
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [remaining, expired, onExpire, onTick])

  // Derived parts
  const parts = useMemo(() => {
    const sec = remaining
    const days = Math.floor(sec / 86400)
    const hrs = Math.floor((sec % 86400) / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    const secs = sec % 60
    return { days, hrs, mins, secs }
  }, [remaining])

  const pad2 = (n) => n.toString().padStart(2, '0')

  // Colors by thresholds
  const colorCls =
    remaining > warnAtSeconds
      ? 'text-green-400'
      : remaining > dangerAtSeconds
      ? 'text-yellow-300'
      : 'text-red-500'

  // Formatted string
  const label = useMemo(() => {
    const { days, hrs, mins, secs } = parts
    if (compact) {
      if (days > 0) {
        const h = padHours ? pad2(hrs) : String(hrs)
        return `${days}:${h}:${pad2(mins)}:${pad2(secs)}`
      }
      return `${hrs}:${pad2(mins)}:${pad2(secs)}`
    }
    // long form
    if (days > 0) {
      const h = padHours ? pad2(hrs) : String(hrs)
      return `${days}d ${h}h ${pad2(mins)}m ${pad2(secs)}s`
    }
    if (parts.hrs > 0) return `${parts.hrs}h ${pad2(parts.mins)}m ${pad2(parts.secs)}s`
    if (parts.mins > 0) return `${parts.mins}m ${pad2(parts.secs)}s`
    return `${parts.secs}s`
  }, [parts, compact, padHours])

  if (expired) {
    return (
      <span
        className={`text-red-500 font-bold ${endedBounce ? 'animate-bounce' : ''} ${className}`}
        aria-live="polite"
      >
        ⏰ Ended
      </span>
    )
  }

  return (
    <span
      className={`${colorCls} font-mono font-semibold ${className}`}
      aria-live="polite"
      title={new Date(Number(targetTimestamp) * 1000).toLocaleString()}
    >
      {showLabel && '⏳ Live — '}
      {label}
    </span>
  )
}
