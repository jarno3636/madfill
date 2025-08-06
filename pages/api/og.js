import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const { id } = req.query

  try {
    let filePath

    if (id) {
      // Check for a specific round OG image (e.g., saved as public/og/round-123.png)
      const roundImage = path.resolve(`./public/og/round-${id}.png`)
      if (fs.existsSync(roundImage)) {
        filePath = roundImage
      } else {
        console.warn(`OG image for round-${id} not found, using fallback`)
        filePath = path.resolve('./public/og/cover.PNG')
      }
    } else {
      filePath = path.resolve('./public/og/cover.PNG')
    }

    const imageBuffer = fs.readFileSync(filePath)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(imageBuffer)
  } catch (err) {
    console.error('OG image error:', err)
    res.status(500).send('Error loading OG image')
  }
}
