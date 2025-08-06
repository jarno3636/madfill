// pages/frame.js
import Head from 'next/head'

export default function FrameLanding() {
  const siteUrl = 'https://madfill.vercel.app'
  const id = '123' // TODO: Make dynamic if needed later

  const roundUrl = `${siteUrl}/round/${id}`
  const imageUrl = `${siteUrl}/api/og?id=${id}`
  const frameApiUrl = `${siteUrl}/api/frame?id=${id}`

  return (
    <>
      <Head>
        {/* SEO + OpenGraph + Twitter */}
        <title>MadFill Round #{id}</title>
        <meta name="description" content="Vote directly in Farcaster on the funniest MadFill card! 🗳️" />
        <meta property="og:title" content={`MadFill Round #${id}`} />
        <meta property="og:description" content="Vote directly in Farcaster on the funniest MadFill card! Winner takes the prize pool! 🏆" />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={roundUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`MadFill Round #${id}`} />
        <meta name="twitter:description" content="Vote directly in Farcaster on the funniest MadFill card! 🗳️" />
        <meta name="twitter:image" content={imageUrl} />

        {/* Farcaster Frame - Voting frame points to interactive API */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={imageUrl} />
        <meta property="fc:frame:post_url" content={frameApiUrl} />
        <meta property="fc:frame:button:1" content="Vote 😂 Original" />
        <meta property="fc:frame:button:2" content="Vote 😆 Challenger" />
        <meta property="fc:frame:button:3" content="View Round" />
        <meta property="fc:frame:button:3:action" content="link" />
        <meta property="fc:frame:button:3:target" content={roundUrl} />
        <meta property="fc:frame:button:4" content="Submit Challenger" />
        <meta property="fc:frame:button:4:action" content="link" />
        <meta property="fc:frame:button:4:target" content={`${siteUrl}/challenge`} />
      </Head>

      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center text-center p-6">
        <h1 className="text-3xl font-bold mb-4">🎭 MadFill Farcaster Frame</h1>
        <p className="text-slate-300 max-w-xl">
          This page is optimized for Warpcast previews and interactive Frames.
          Vote directly inside Warpcast or share your own challenge!
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Visit{' '}
          <a href={roundUrl} className="underline text-indigo-400">Round #{id}</a>{' '}or{' '}
          <a href={`${siteUrl}/challenge`} className="underline text-purple-400">Submit a Challenger</a>
        </p>
      </div>
    </>
  )
}
