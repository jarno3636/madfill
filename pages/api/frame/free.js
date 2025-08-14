// pages/api/frame/free.js
// A minimal Farcaster Frame that cycles your Free Game template + words
// Uses your existing /api/og generator for the image.
// Cast/link THIS URL (https://<your-host>/api/frame/free) on Warpcast.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
const OG = (q) => `${SITE}/api/og?${q}`

// ---------- utils ----------
const clampInt = (v, min, max, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d
}
const sanitize = (s) =>
  String(s || '')
    .trim()
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, 16)

function parseQS(url) {
  const u = new URL(url, SITE)
  return {
    c: clampInt(u.searchParams.get('c'), 0, 99, 0),
    t: clampInt(u.searchParams.get('t'), 0, 99, 0),
    w: (u.searchParams.get('w') || '')
      .split(',')
      .map((s) => sanitize(s))
      .filter(Boolean)
      .join(','),
  }
}

function qs(obj) {
  const p = new URLSearchParams()
  if (obj.c != null) p.set('c', String(obj.c))
  if (obj.t != null) p.set('t', String(obj.t))
  if (obj.w != null) p.set('w', String(obj.w))
  return p.toString()
}

const TOKENS = [
  'neon','taco','llama','vibe','laser','noodle','glow','pixel','dino','jazz','biscuit','vortex','meta','sprocket'
]
const rand = (n) => Math.floor(Math.random() * n)
const randWord = () => TOKENS[rand(TOKENS.length)]

// Safe body parse for Warpcast POST (can be parsed JSON or raw string)
function parseBody(req) {
  const b = req.body
  if (!b) return {}
  if (typeof b === 'string') {
    try { return JSON.parse(b) } catch { return {} }
  }
  // Next.js often parses JSON already
  return b
}

function frameHtml({ imageUrl, postUrl, c, t, w }) {
  const playUrl = `${SITE}/free?${qs({ c, t, w })}`
  return `<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta property="og:title" content="MadFill — Free Game" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="fc:frame" content="vNext" />
    <meta name="fc:frame:image" content="${imageUrl}" />
    <meta name="fc:frame:post_url" content="${postUrl}" />

    <meta name="fc:frame:button:1" content="🪄 Surprise Me" />
    <meta name="fc:frame:button:1:action" content="post" />

    <meta name="fc:frame:button:2" content="🎲 Random Template" />
    <meta name="fc:frame:button:2:action" content="post" />

    <meta name="fc:frame:button:3" content="▶️ Play on Web" />
    <meta name="fc:frame:button:3:action" content="link" />
    <meta name="fc:frame:button:3:target" content="${playUrl}" />

    <meta name="fc:frame:button:4" content="🔗 Copy Link" />
    <meta name="fc:frame:button:4:action" content="link" />
    <meta name="fc:frame:button:4:target" content="${playUrl}" />
  </head>
  <body />
</html>`
}

export default async function handler(req, res) {
  try {
    // Current "state" derived from the request URL
    const { c, t, w } = parseQS(req.url)

    if (req.method === 'POST') {
      const body = parseBody(req)
      const ix = Number(body?.untrustedData?.buttonIndex || 0)

      let next = { c, t, w }
      if (ix === 1) {
        // Surprise Me → ensure 3 words present (existing kept if already there)
        const words = (w ? w.split(',') : []).filter(Boolean)
        const w1 = sanitize(words[0] || randWord())
        const w2 = sanitize(words[1] || randWord())
        const w3 = sanitize(words[2] || randWord())
        next.w = [w1, w2, w3].join(',')
      } else if (ix === 2) {
        // Random Template → shuffle c/t within safe ranges
        next.c = rand(7) // adjust IN UI later if category count changes
        next.t = rand(6) // adjust IN UI later if max templates per category changes
      }

      const postUrl = `${SITE}/api/frame/free?${qs(next)}`
      const imageUrl = OG(`screen=free&title=Free%20MadFill&subtitle=Make%20a%20card!&${qs(next)}`)

      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
      return res.status(200).send(frameHtml({ imageUrl, postUrl, ...next }))
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).end('Method Not Allowed')
    }

    // Initial GET render
    const state = { c, t, w }
    const postUrl = `${SITE}/api/frame/free?${qs(state)}`
    const imageUrl = OG(`screen=free&title=Free%20MadFill&subtitle=Make%20a%20card!&${qs(state)}`)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    return res.status(200).send(frameHtml({ imageUrl, postUrl, ...state }))
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send('<!doctype html><html><head></head><body></body></html>')
  }
}
