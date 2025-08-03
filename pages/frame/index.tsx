// pages/frame/index.tsx
import { ImageResponse } from 'next/server'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roundId = searchParams.get('id') || '???'

  const title = `MadFill Round #${roundId}`
  const subtitle = 'Vote for the funniest card!'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom right, #4f46e5, #7c3aed)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '40px',
          textAlign: 'center'
        }}
      >
        <h1 style={{ fontSize: '64px', margin: '0 0 20px' }}>{title}</h1>
        <p style={{ fontSize: '36px', margin: 0 }}>{subtitle}</p>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  )
}
