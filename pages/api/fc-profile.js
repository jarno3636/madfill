// pages/api/fc-profile.js

// Server-only API route to fetch a Farcaster profile via Neynar.
// Priority: fid > address > username. Returns { user: null } for 404s.

const NEYNAR_BASE = 'https://api.neynar.com/v2/farcaster'
const KEY = process.env.NEYNAR_API_KEY // server-side ONLY

export const config = {
  api: { bodyParser: false },
}

// --- small validators (no deps) ---
function isHexAddress(s) {
  return typeof s === 'string' && /^0x[a-fA-F0-9]{40}$/.test(s)
}
function isNumeric(s) {
  return typeof s === 'string' && /^[0-9]+$/.test(s)
}
function isValidUsername(s) {
  // Farcaster usernames: letters, numbers, underscores, hyphens; 1–32 chars (conservative bound)
  return typeof s === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(s)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!KEY) {
    return res.status(500).json({ error: 'Missing NEYNAR_API_KEY on server' })
  }

  try {
    const q = req.query || {}

    // Trim & normalize inputs
    const fid = typeof q.fid === 'string' ? q.fid.trim() : ''
    const address = typeof q.address === 'string' ? q.address.trim().toLowerCase() : ''
    const usernameRaw = typeof q.username === 'string' ? q.username.trim() : ''
    const username = usernameRaw.replace(/^@/, '') // strip leading @ if present

    // Build Neynar URL with clear priority: fid > address > username
    let url = null
    if (fid && isNumeric(fid)) {
      // GET /user/bulk?fids=...
      url = `${NEYNAR_BASE}/user/bulk?fids=${encodeURIComponent(fid)}`
    } else if (address && isHexAddress(address)) {
      // GET /user-by-verification?address=...
      url = `${NEYNAR_BASE}/user-by-verification?address=${encodeURIComponent(address)}`
    } else if (username && isValidUsername(username)) {
      // GET /user-by-username?username=...
      url = `${NEYNAR_BASE}/user-by-username?username=${encodeURIComponent(username)}`
    } else {
      return res.status(400).json({ error: 'Provide valid fid, address, or username' })
    }

    // Abort after a short timeout to avoid hanging serverless invocations
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 8000)

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        // Neynar supports either header casing; send both defensively.
        api_key: KEY,
        'X-API-KEY': KEY,
      },
      signal: controller.signal,
    }).catch((err) => {
      // Convert abort/errors into a consistent 504/502 style message
      if (err?.name === 'AbortError') {
        const e = new Error('Upstream timeout')
        e.status = 504
        throw e
      }
      const e = new Error('Upstream fetch failed')
      e.status = 502
      throw e
    })
    clearTimeout(t)

    // Normalize not-found to { user: null }
    if (!r.ok) {
      if (r.status === 404) {
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=86400')
        return res.status(200).json({ user: null })
      }
      const text = await r.text().catch(() => '')
      return res.status(r.status).json({ error: `Neynar error: ${text || r.statusText}` })
    }

    const data = await r.json().catch(() => ({}))
    const user = data?.users?.[0] || data?.user || null

    // Edge cache: profiles don’t change constantly
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')

    return res.status(200).json({
      user: user
        ? {
            fid: user.fid ?? null,
            username: user.username ?? null,
            displayName: user.display_name ?? null,
            pfp_url: user.pfp?.url ?? null,
            custody_address: user.custody_address ?? null,
            verifications: Array.isArray(user.verified_addresses?.eth_addresses)
              ? user.verified_addresses.eth_addresses
              : [],
          }
        : null,
    })
  } catch (err) {
    console.error('fc-profile error:', err)
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    return res.status(status).json({ error: err?.message || 'Internal error' })
  }
}
