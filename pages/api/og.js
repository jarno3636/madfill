// pages/api/og.js
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const exts = ['.png', '.webp', '.jpg', '.jpeg']

function sanitizeId(raw) {
  // allow only digits to prevent path shenanigans; adjust if your IDs can be different
  return String(raw || '').replace(/[^\d]/g, '')
}

async function findOgForRound(id) {
  const baseDir = path.join(process.cwd(), 'public', 'og')
  for (const ext of exts) {
    const p = path.join(baseDir, `round-${id}${ext}`)
    try {
      await fs.access(p)
      return p
    } catch {}
  }
  return null
}

async function readWithMeta(filePath) {
  const data = await fs.readFile(filePath)
  const stat = await fs.stat(filePath)
  const etag = crypto.createHash('sha1').update(data).digest('hex')
  return { data, mtime: stat.mtime, etag }
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

export default async function handler(req, res) {
  try {
    const id = sanitizeId(req.query.id)
    const baseDir = path.join(process.cwd(), 'public', 'og')

    let filePath
    if (id) {
      filePath = await findOgForRound(id)
    }
    if (!filePath) {
      // global fallback
      for (const ext of exts) {
        const p = path.join(baseDir, `cover${ext}`)
        try {
          await fs.access(p)
          filePath = p
          break
        } catch {}
      }
    }
    if (!filePath) {
      res.status(404).send('OG image not found')
      return
    }

    const { data, mtime, etag } = await readWithMeta(filePath)

    // Caching: 1 day browser, CDN can keep longer
    res.setHeader('Content-Type', mimeFromExt(filePath))
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
    res.setHeader('ETag', etag)
    res.setHeader('Last-Modified', mtime.toUTCString())

    // ETag check (cheap 304s)
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end()
      return
    }

    res.status(200).send(data)
  } catch (err) {
    console.error('OG image error:', err)
    res.status(500).send('Error loading OG image')
  }
}
