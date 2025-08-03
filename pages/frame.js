import Head from 'next/head'

export default function FrameLanding() {
  const siteUrl = 'https://madfill.vercel.app'
  const id = '123' // Replace with dynamic logic later if needed

  return (
    <>
      <Head>
        <meta property="og:title" content={`MadFill Round ${id}`} />
        <meta property="og:description" content="Vote on the funniest MadFill card. Winner takes the prize pool! 🏆" />
        <meta property="og:image" content={`${siteUrl}/api/og?id=${id}`} />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={`${siteUrl}/api/og?id=${id}`} />
        <meta property="fc:frame:button:1" content="Vote Now 🗳️" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={`${siteUrl}/round/${id}`} />
        <meta property="fc:frame:button:2" content="Submit Challenger 😆" />
        <meta property="fc:frame:button:2:action" content="link" />
        <meta property="fc:frame:button:2:target" content={`${siteUrl}/challenge`} />
      </Head>
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎭 MadFill Farcaster Frame</h1>
        <p>This page is optimized for Warpcast previews.</p>
      </div>
    </>
  )
}
