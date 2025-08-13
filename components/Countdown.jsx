// components/Countdown.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

function safeInt(n, fallback = 0) {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

function useStableCallback(fn) {
  const ref = useRef(fn)
  ref.current = fn
  return ref
}

function CountdownRing({
  targetTimestamp,
  totalSeconds = 24 * 3600,
  size = 72,
  stroke = 6,
  trackColor = 'rgb(51 65 85)',      // slate-700
  progressColor = 'rgb(34 197 94)',  // green-500
  textColor = '#fff',
  showLabel = true,
  onExpire = () => {},
  className = '',
}) {
  // Coerce inputs safely
  const targetTs = safeInt(targetTimestamp, 0)
  const total = Math.max(1, safeInt(totalSeconds, 0))

  // Compute initial remaining (in seconds)
  const nowSec = Math.floor(Date.now() / 1000)
  const initialRemaining = Math.max(targetTs - nowSec, 0)

  const [remaining, setRemaining] = useState(initialRemaining)
  const [expired, setExpired] = useState(initialRemaining <= 0)
  const timerRef = useRef(null)
  const onExpireRef = useStableCallback(onExpire)

  // Re-sync when target changes
  useEffect(() => {
    const r = Math.max(safeInt(targetTimestamp, 0) - Math.floor(Date.now() / 1000), 0)
    setRemaining(r)
    setExpired(r <= 0)
  }, [targetTimestamp])

  // Ticker aligned to wall-clock seconds to minimize drift
  useEffect(() => {
    if (remaining <= 0) {
      if (!expired) {
        setExpired(true)
        try {
          onExpireRef.current?.()
        } catch { /* no-op */ }
      }
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    const now = Date.now()
    const next = Math.ceil(now / 1000) * 1000
    timerRef.current = setTimeout(() => {
      setRemaining((r) => Math.max(r - 1, 0))
    }, Math.max(next - now, 0))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [remaining, expired, onExpireRef])

  // Geometry
  const radius = Math.max(0, (size - stroke) / 2)
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, remaining / total))

  const dash = useMemo(
    () => ({
      dasharray: circumference.toFixed(2),
      dashoffset: ((1 - ratio) * circumference).toFixed(2),
    }),
    [circumference, ratio]
  )

  // Label
  const pad2 = (n) => String(n).padStart(2, '0')
  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const label = hrs > 0 ? `${hrs}:${pad2(mins)}:${pad2(secs)}` : `${mins}:${pad2(secs)}`
  const title = targetTs ? new Date(targetTs * 1000).toLocaleString() : 'No deadline'

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={expired ? 'Ended' : `Remaining ${label}`}
      title={title}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          opacity="0.35"
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progressColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.45s linear',
              strokeDasharray: dash.dasharray,
              strokeDashoffset: dash.dashoffset,
            }}
          />
        </g>
      </svg>
      {showLabel && (
        <div
          className="absolute text-[11px] font-semibold select-none"
          style={{ color: textColor }}
        >
          {expired ? 'Ended' : label}
        </div>
      )}
    </div>
  )
}

CountdownRing.propTypes = {
  targetTimestamp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  totalSeconds: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  size: PropTypes.number,
  stroke: PropTypes.number,
  trackColor: PropTypes.string,
  progressColor: PropTypes.string,
  textColor: PropTypes.string,
  showLabel: PropTypes.bool,
  onExpire: PropTypes.func,
  className: PropTypes.string,
}

export default CountdownRing
export { CountdownRing as Countdown } // keeps named import compatibility
