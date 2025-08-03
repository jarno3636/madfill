// pages/api/frame/index.ts
import { NextResponse } from 'next/server'
import { createFrame } from 'frames.js'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'

export async function GET() {
  const frame = createFrame({
    image: `${SITE_URL}/frame/preview`,
    postUrl: `${SITE_URL}/api/frame/submit`,
    buttons: [
      { label: 'Play MadFill', action: 'link', target: `${SITE_URL}` },
      { label: 'My Rounds', action: 'link', target: `${SITE_URL}/myo` },
    ]
  })
  return new NextResponse(frame.toResponse(), { headers: frame.headers })
}
