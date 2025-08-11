// pages/api/fc-profile.js

const NEYNAR_BASE = 'https://api.neynar.com/v2/farcaster'
const KEY = process.env.NEYNAR_API_KEY // server-side ONLY

export const config = {
  api: { bodyParser: false },
}

function isHexAddress(s) {
  return typeof s === 'string' && /^0x[a-fA-F0-9]{40}$/.test(s)
}
function isNumeric(s) {
  return typeof s === 'string' && /^[0-9]+$/.test(s)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!KEY) {
    return res.status(500).json({ error: 'Missing NEYNAR_API_KEY on server' })
  }

  try {
    const q = req.query || {}
    const fid = typeof q.fid === 'string' ? q.fid.trim() : ''
    const address = typeof q.address === 'string' ? q.address.trim().toLowerCase() : ''
    const usernameRaw = typeof q.username === 'string' ? q.username.trim() : ''
    const username = usernameRaw.replace(/^@/, '') // strip @ if present

    let url
    if (fid && isNumeric(fid)) {
      url = `${NEYNAR_BASE}/user/bulk?fids=${encodeURIComponent(fid)}`
    } else if (address && isHexAddress(address)) {
      url = `${NEYNAR_BASE}/user-by-verification?address=${encodeURIComponent(address)}`
    } else if (username) {
      url = `${NEYNAR_BASE}/user-by-username?username=${encodeURIComponent(username)}`
    } else {
      return res.status(400).json({ error: 'Provide fid, address, or username' })
    }

    const r = await fetch(url, {
      headers: {
        accept: 'application/json',
        // Send both header styles for safety
        api_key: KEY,
        'X-API-KEY': KEY,
      },
    })

    // Neynar returns 404 for unknown users; normalize to { user: null }
    if (!r.ok) {
      if (r.status === 404) {
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=86400')
        return res.status(200).json({ user: null })
      }
      const text = await r.text()
      return res.status(r.status).json({ error: `Neynar error: ${text}` })
    }

    const data = await r.json().catch(() => ({}))
    const user = data?.users?.[0] || data?.user || null

    // Profiles don’t change constantly; cache at the edge/CDN
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')

    return res.status(200).json({
      user: user
        ? {
            fid: user.fid ?? null,
            username: user.username ?? null,
            displayName: user.display_name ?? null,
            pfp_url: user.pfp?.url ?? null,
            custody_address: user.custody_address ?? null,
            verifications: user.verified_addresses?.eth_addresses ?? [],
          }
        : null,
    })
  } catch (err) {
    console.error('fc-profile error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
