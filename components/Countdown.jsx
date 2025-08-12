// components/Countdown.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

function CountdownRing({
  targetTimestamp,
  totalSeconds = 24 * 3600,
  size = 72,
  stroke = 6,
  trackColor = 'rgb(51 65 85)',
  progressColor = 'rgb(34 197 94)',
  textColor = '#fff',
  showLabel = true,
  onExpire = () => {},
  className = '',
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(Number(targetTimestamp) - Math.floor(Date.now() / 1000), 0)
  )
  const [expired, setExpired] = useState(remaining <= 0)
  const timerRef = useRef(null)

  useEffect(() => {
    const r = Math.max(Number(targetTimestamp) - Math.floor(Date.now() / 1000), 0)
    setRemaining(r)
    setExpired(r <= 0)
  }, [targetTimestamp])

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
    timerRef.current = setTimeout(
      () => setRemaining((r) => Math.max(r - 1, 0)),
      Math.max(next - now, 0)
    )
    return () => timerRef.current && clearTimeout(timerRef.current)
  }, [remaining, expired, onExpire])

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds)))
  const dash = useMemo(() => ({
    dasharray: circumference.toFixed(2),
    dashoffset: ((1 - ratio) * circumference).toFixed(2),
  }), [circumference, ratio])

  const pad2 = (n) => n.toString().padStart(2, '0')
  const hrs = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const label = hrs > 0 ? `${hrs}:${pad2(mins)}:${pad2(secs)}` : `${mins}:${pad2(secs)}`

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} strokeLinecap="round" opacity="0.35" />
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          <circle
            cx={size/2} cy={size/2} r={radius} fill="none" stroke={progressColor} strokeWidth={stroke} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.45s linear', strokeDasharray: dash.dasharray, strokeDashoffset: dash.dashoffset }}
          />
        </g>
      </svg>
      {showLabel && (
        <div className="absolute text-[11px] font-semibold select-none" style={{ color: textColor }} title={new Date(Number(targetTimestamp) * 1000).toLocaleString()}>
          {expired ? 'Ended' : label}
        </div>
      )}
    </div>
  )
}

export default CountdownRing
export { CountdownRing as Countdown } // ✅ satisfies imports that expect { Countdown }
