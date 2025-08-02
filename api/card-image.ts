import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get('text') || 'MadFill'

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 36,
          background: 'linear-gradient(to bottom right, #0f172a, #4f46e5)',
          width: '100%',
          height: '100%',
          padding: '40px',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', lineHeight: 1.4, maxWidth: 700 }}>
          {text}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
