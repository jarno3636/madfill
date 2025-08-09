// pages/api/og.js
import { ImageResponse } from '@vercel/og'

export const config = {
  runtime: 'edge', // Required for @vercel/og
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)

    const title = searchParams.get('title') || 'MadFill — Active Rounds'
    const subtitle = searchParams.get('subtitle') || 'Fill the blank. Make it funny. Win the pot.'
    const screen = searchParams.get('screen') || ''
    const roundId = searchParams.get('roundId') || ''

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px',
            background: 'linear-gradient(135deg, #1e1b4b, #6d28d9, #0891b2)',
            color: 'white',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 32, color: '#c7d2fe', marginTop: 16 }}>{subtitle}</div>
          {screen && (
            <div style={{ fontSize: 26, color: '#93c5fd', marginTop: 12 }}>Screen: {screen}</div>
          )}
          {roundId && (
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a5b4fc', marginTop: 8 }}>
              Round #{roundId}
            </div>
          )}
          <div style={{ fontSize: 22, color: '#e5e7eb', marginTop: 'auto' }}>
            madfill.vercel.app
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e) {
    return new Response('Failed to generate image', { status: 500 })
  }
}
