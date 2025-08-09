// pages/api/og.js

export default function handler(req, res) {
  try {
    const {
      title = 'MadFill — Active Rounds',
      subtitle = 'Fill the blank. Make it funny. Win the pot.',
      roundId = '',
      screen = 'active',
    } = req.query

    const safe = (s) => String(s || '').slice(0, 140)
    const t = safe(title)
    const sub = safe(subtitle)
    const rid = safe(roundId)
    const scr = safe(screen)

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="50%" stop-color="#6d28d9"/>
            <stop offset="100%" stop-color="#0891b2"/>
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
          </filter>
        </defs>
        <rect width="1200" height="630" fill="url(#g)" />
        <rect x="36" y="36" width="1128" height="558" rx="28" fill="rgba(0,0,0,0.35)" />
        <text x="80" y="230" fill="#fff" font-size="66" font-weight="800"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial"
          filter="url(#shadow)">${escapeXml(t)}</text>
        <text x="80" y="300" fill="#c7d2fe" font-size="30" font-weight="600"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial">
          ${escapeXml(sub)}
        </text>
        <text x="80" y="360" fill="#93c5fd" font-size="26" font-weight="700"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial">
          ${scr ? `Screen: ${escapeXml(scr)}` : ''}
        </text>
        ${rid
          ? `<text x="80" y="410" fill="#a5b4fc" font-size="28" font-weight="800"
               font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial">
               Round #${escapeXml(rid)}
             </text>`
          : ''
        }
        <text x="80" y="500" fill="#e5e7eb" font-size="22" font-weight="600"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial">
          madfill.vercel.app
        </text>
      </svg>
    `.trim()

    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1200, stale-while-revalidate=86400')
    res.status(200).send(svg)
  } catch (e) {
    res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>')
  }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
