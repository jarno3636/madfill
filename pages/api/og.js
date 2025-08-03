// pages/api/og.js
import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  try {
    const filePath = path.resolve('./public/og/cover.PNG') // ← match exact filename
    const imageBuffer = fs.readFileSync(filePath)

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(imageBuffer)
  } catch (err) {
    console.error('OG image error:', err)
    res.status(500).send('Error loading image')
  }
}
