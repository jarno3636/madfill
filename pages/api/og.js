export default async function handler(req, res) {
  const { id } = req.query
  const imageBuffer = await fetch('https://madfill.vercel.app/og/cover.png').then(r => r.arrayBuffer())

  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.status(200).send(Buffer.from(imageBuffer))
}
