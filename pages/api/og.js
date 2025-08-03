// pages/api/og.js
export default async function handler(req, res) {
  const { id } = req.query

  const imageBuffer = await generateOgImage(id) // Your logic here
  res.setHeader('Content-Type', 'image/png')
  res.send(imageBuffer)
}
