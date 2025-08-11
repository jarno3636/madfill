// pages/api/og.js
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

const clamp = (s = '', n = 120) =>
  String(s).replace(/\s+/g, ' ').slice(0, n)

const accentFor = (screen) => {
  switch ((screen || '').toLowerCase()) {
    case 'round': return ['#0f172a', '#3730a3', '#06b6d4']   // slate → indigo → cyan
    case 'active': return ['#0f172a', '#7c3aed', '#22c55e']  // slate → violet → green
    case 'vote': return ['#0f172a', '#2563eb', '#f59e0b']    // slate → blue → amber
    case 'free': return ['#0f172a', '#9333ea', '#ef4444']    // slate → purple → red
    default: return ['#1e1b4b', '#6d28d9', '#0891b2']        // your original
  }
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)

    const title    = clamp(searchParams.get('title') || 'MadFill — Active Rounds', 80)
    const subtitle = clamp(searchParams.get('subtitle') || 'Fill the blank. Make it funny. Win the pot.', 120)
    const screen   = clamp(searchParams.get('screen') || '', 24)
    const roundId  = clamp(searchParams.get('roundId') || searchParams.get('id') || '', 12)

    const [c1, c2, c3] = accentFor(screen)

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px',
            background: `linear-gradient(135deg, ${c1}, ${c2}, ${c3})`,
            color: '#fff',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial',
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </div>

          <div style={{ fontSize: 30, color: 'rgba(255,255,255,.9)', marginTop: 18 }}>
            {subtitle}
          </div>

          {(screen || roundId) && (
            <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 26, color: 'rgba(255,255,255,.85)' }}>
              {screen && <div>🧩 {screen}</div>}
              {roundId && <div>🏷️ Round #{roundId}</div>}
            </div>
          )}

          <div style={{ marginTop: 'auto', fontSize: 22, color: 'rgba(255,255,255,.85)' }}>
            madfill.vercel.app
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (e) {
    // If rendering fails, return a tiny PNG-ish fallback
    return new Response('OG generation failed', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
