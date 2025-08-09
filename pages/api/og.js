// pages/api/og.js
import { ImageResponse } from '@vercel/og'

export const config = {
  runtime: 'edge',
}

function safe(s, n = 140) {
  return String(s || '').slice(0, n)
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const title   = safe(searchParams.get('title')   || 'MadFill — Active Rounds')
    const subtitle= safe(searchParams.get('subtitle')|| 'Fill the blank. Make it funny. Win the pot.')
    const roundId = safe(searchParams.get('roundId') || '')
    const screen  = safe(searchParams.get('screen')  || 'active')

    const res = new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: 'flex',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #6d28d9 50%, #0891b2 100%)',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", "Helvetica Neue", Arial',
          }}
        >
          {/* glass card */}
          <div
            style={{
              position: 'absolute',
              left: 36,
              top: 36,
              width: 1128,
              height: 558,
              borderRadius: 28,
              background: 'rgba(0,0,0,0.35)',
            }}
          />
          <div style={{ position: 'relative', padding: '72px 80px', color: '#fff' }}>
            <div
              style={{
                fontSize: 66,
                fontWeight: 800,
                textShadow: '0 2px 6px rgba(0,0,0,.5)',
                lineHeight: 1.1,
                marginBottom: 18,
                maxWidth: 1000,
              }}
            >
              {title}
            </div>

            <div style={{ fontSize: 30, fontWeight: 600, color: '#c7d2fe', marginBottom: 10 }}>
              {subtitle}
            </div>

            {screen && (
              <div style={{ fontSize: 26, fontWeight: 700, color: '#93c5fd', marginTop: 10 }}>
                Screen: {screen}
              </div>
            )}

            {roundId && (
              <div style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc', marginTop: 14 }}>
                Round #{roundId}
              </div>
            )}

            <div style={{ position: 'absolute', bottom: 60, left: 80, fontSize: 22, fontWeight: 600, color: '#e5e7eb' }}>
              madfill.vercel.app
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )

    // Cache nicely for Warpcast / social crawlers
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=1200, stale-while-revalidate=86400')
    return res
  } catch (e) {
    // tiny transparent PNG fallback
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    return new Response(Buffer.from(png1x1, 'base64'), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
      status: 200,
    })
  }
}
