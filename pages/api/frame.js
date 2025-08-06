// pages/api/frame.js
export default async function handler(req, res) {
  const { id } = req.query
  const siteUrl = 'https://madfill.vercel.app'

  // Validate round ID
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Missing or invalid round ID' })
  }

  const imageUrl = `${siteUrl}/api/og?id=${id}`

  // Respond with frame JSON metadata
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({
    title: `MadFill Round #${id}`,
    description: 'Vote on the funniest card. Winner gets the prize pool! 🏆',
    image: imageUrl,
    imageAspectRatio: '1.91:1',
    buttons: [
      {
        label: '😂 Original',
        action: 'post',
        target: `${siteUrl}/api/frame/route?id=${id}&vote=original`
      },
      {
        label: '😆 Challenger',
        action: 'post',
        target: `${siteUrl}/api/frame/route?id=${id}&vote=challenger`
      },
      {
        label: '👀 View Round',
        action: 'link',
        target: `${siteUrl}/round/${id}`
      },
      {
        label: '🚀 Submit Challenger',
        action: 'link',
        target: `${siteUrl}/challenge`
      },
    ],
  })
}
