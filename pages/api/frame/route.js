// pages/api/frame/route.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { untrustedData } = req.body || {}
    const { fid, buttonIndex, inputText, castId } = untrustedData || {}
    const siteUrl = 'https://madfill.vercel.app'

    // Determine vote target
    const roundId = inputText || '123' // In future, derive this dynamically
    const votedFor = buttonIndex === 1 ? 'Original' : 'Challenger'

    console.log(`🗳️ Farcaster Vote Received`)
    console.log(`FID: ${fid}, Cast: ${castId?.fid}:${castId?.hash}`)
    console.log(`Voted for: ${votedFor} in Round ${roundId}`)

    // Simulate recording the vote (replace with contract call or DB later)

    // Build follow-up frame (confirmation)
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      image: `${siteUrl}/og/vote-confirmed.png`, // Optional confirmation image
      postUrl: `${siteUrl}/api/frame/route`,     // Keeps the flow alive if needed
      imageAspectRatio: '1.91:1',
      title: '✅ Vote Recorded!',
      description: `You voted for ${votedFor} in Round ${roundId}.`,
      buttons: [
        {
          label: '🎯 View Round',
          action: 'link',
          target: `${siteUrl}/round/${roundId}`,
        },
        {
          label: '📊 Leaderboard',
          action: 'link',
          target: `${siteUrl}/leaderboard`,
        },
      ],
    })
  } catch (err) {
    console.error('Frame vote error:', err)
    return res.status(500).json({ error: 'Frame vote failed' })
  }
}
