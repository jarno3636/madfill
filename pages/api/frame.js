// pages/api/frame.js
export default async function handler(req, res) {
  const { id, kind = 'pool2' } = req.query
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'

  // Validate id
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Missing or invalid id' })
  }

  // kind=pool2 means "challenge id". kind=round means "round id" and the route will resolve the active challenge.
  const imageUrl = `${siteUrl}/api/og?id=${id}`

  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json({
    title: `MadFill ${kind === 'pool2' ? 'Challenge' : 'Round'} #${id}`,
    description: 'Pick the punchline. Winner splits the pool. 🏆',
    image: imageUrl,
    imageAspectRatio: '1.91:1',
    buttons: [
      {
        label: '😂 Original',
        action: 'post',
        target: `${siteUrl}/api/frame/route?id=${id}&kind=${kind}&vote=original`
      },
      {
        label: '😆 Challenger',
        action: 'post',
        target: `${siteUrl}/api/frame/route?id=${id}&kind=${kind}&vote=challenger`
      },
      {
        label: '👀 View',
        action: 'link',
        target: kind === 'pool2' ? `${siteUrl}/vote` : `${siteUrl}/round/${id}`
      },
      {
        label: '🚀 Submit Challenger',
        action: 'link',
        target: `${siteUrl}/challenge`
      },
    ],
  })
}
