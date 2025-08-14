// components/StyledCard.jsx
'use client'

/**
 * Responsive preview card for free play + elsewhere.
 * - Never exceeds its parent width
 * - Breaks/ wraps long words safely
 * - Scales nicely on small screens
 */
export default function StyledCard({
  parts = [],
  blanks = 0,
  words = {},
  className = '',
}) {
  const out = []
  const n = Array.isArray(parts) ? parts.length : 0
  const safeBlanks = Math.max(0, blanks)

  for (let i = 0; i < n; i++) {
    out.push(parts[i] ?? '')
    if (i < safeBlanks) {
      const w = String(words?.[i] ?? '').trim()
      out.push(w || '____')
    }
  }

  return (
    <div
      className={[
        'w-full max-w-full',
        'rounded-xl border border-slate-700',
        'bg-gradient-to-br from-slate-900 to-slate-800',
        'p-4 sm:p-5',
        // overflow protection
        'overflow-hidden',
        className,
      ].join(' ')}
    >
      <p
        className={[
          'text-slate-100',
          'text-base sm:text-lg md:text-xl',
          'leading-relaxed',
          // wrap & prevent horizontal scroll
          'whitespace-pre-wrap break-words break-normal',
          'hyphens-auto',
        ].join(' ')}
      >
        {out.join('')}
      </p>
    </div>
  )
}
