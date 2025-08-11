// pages/api/frame/round.js
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'

function clampInt(v, min, max, d = 1) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d
}
function qs(obj) {
  const p = new URLSearchParams()
  if (obj.id != null) p.set('id', String(obj.id))
  return p.toString()
}
function frameHtml({ id }) {
  const pageUrl = `${SITE}/round/${id}`
  const og = `${SITE}/api/og?screen=round&roundId=${id}`

  return `<!doctype html><html><head>
    <meta property="og:title" content="MadFill — Round #${id}" />
    <meta property="og:image" content="${og}" />

    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${og}" />
    <meta name="fc:frame:post_url" content="${SITE}/api/frame/round?${qs({ id })}" />

    <meta name="fc:frame:button:1" content="🔎 Open Round #${id}" />
    <meta name="fc:frame:button:1:action" content="link" />
    <meta name="fc:frame:button:1:target" content="${pageUrl}" />

    <meta name="fc:frame:button:2" content="◀️ Prev" />
    <meta name="fc:frame:button:2:action" content="post" />

    <meta name="fc:frame:button:3" content="▶️ Next" />
    <meta name="fc:frame:button:3:action" content="post" />

    <meta name="fc:frame:button:4" content="🔗 Share Link" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${pageUrl}" />
  </head><body></body></html>`
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, SITE)
    let id = clampInt(url.searchParams.get('id'), 1, 1_000_000, 1)

    if (req.method === 'POST') {
      const ix = Number(req.body?.untrustedData?.buttonIndex || 0)
      if (ix === 2) id = clampInt(id - 1, 1, 1_000_000, 1)      // Prev
      if (ix === 3) id = clampInt(id + 1, 1, 1_000_000, 1)      // Next
    }

    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(frameHtml({ id }))
  } catch {
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send('<!doctype html><html><head></head><body></body></html>')
  }
}
