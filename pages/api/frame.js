// pages/api/frame.js
export default async function handler(req, res) {
  const { id } = req.query
  const siteUrl = 'https://madfill.vercel.app'

  // Default fallback OG image
  const imageUrl = id
    ? `${siteUrl}/api/og?id=${id}`
    : `${siteUrl}/og/cover.PNG`

  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({
    title: `MadFill Round ${id || ''}`.trim(),
    description: 'Vote on the funniest MadFill card. Winner takes the prize pool! 🏆',
    image: imageUrl,
    imageAspectRatio: '1.91:1',
    buttons: [
      {
        label: 'Vote Now 🗳️',
        action: 'link',
        target: id ? `${siteUrl}/round/${id}` : siteUrl,
      },
      {
        label: 'Submit Challenger 😆',
        action: 'link',
        target: `${siteUrl}/challenge`,
      },
    ],
  })
}
