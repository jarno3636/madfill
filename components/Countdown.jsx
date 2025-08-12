// components/Countdown.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export default function CountdownRing({
  targetTimestamp,        // seconds since epoch
  totalSeconds = 24 * 3600, // for 24h votes; set to the intended duration
  size = 72,               // px
  stroke = 6,              // ring thickness
  trackColor = 'rgb(51 65 85)',     // slate-700
  progressColor = 'rgb(34 197 94)', // green-500
  textColor = '#fff',
  showLabel = true,        // show time text inside the ring
  onExpire = () => {},
  className = '',
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(Number(targetTimestamp) - Math.floor(Date.now() / 1000), 0)
  )
  const [expired, setExpired] = useState(remaining <= 0)
  const timerRef = useRef(null)

  // Recalculate on prop change
  useEffect(() => {
    const r = Math.max(Number(targetTimestamp) - Math.floor(Date.now() / 1000), 0)
    setRemaining(r)
    setExpired(r <= 0)
  }, [targetTimestamp])

  // Zero-drift ticking
  useEffect(() => {
    if (remaining <= 0) {
      if (!expired) {
        setExpired(true)
        try { onExpire?.() } catch {}
      }
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    const now = Date.now()
    const next = Math.ceil(now / 1000) * 1000
    timerRef.current = setTimeout(() => setRemaining((r) => Math.max(r - 1, 0)), Math.max(next - now, 0))
    return () => timerRef.current && clearTimeout(timerRef.current)
  }, [remaining, expired, onExpire])

  // ring math
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds)))
  const dash = useMemo(() => ({
    dasharray: circumference.toFixed(2),
    dashoffset: ((1 - ratio) * circumference).toFixed(2),
  }), [circumference, ratio])

  // text
  const pad2 = (n) => n.toString().padStart(2, '0')
  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const label = hrs > 0 ? `${hrs}:${pad2(mins)}:${pad2(secs)}` : `${mins}:${pad2(secs)}`

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* Track */}
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
        {/* Progress (starts at top, goes clockwise) */}
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
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
          title={new Date(Number(targetTimestamp) * 1000).toLocaleString()}
        >
          {expired ? 'Ended' : label}
        </div>
      )}
    </div>
  )
}
