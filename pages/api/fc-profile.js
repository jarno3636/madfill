// pages/api/fc-profile.js

const NEYNAR_BASE = 'https://api.neynar.com/v2/farcaster'
const KEY = process.env.NEYNAR_API_KEY // server-side ONLY

// Optional: disable body parsing for GETs (harmless either way)
export const config = {
  api: { bodyParser: false },
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
    const { fid, address, username } = req.query || {}
    let url

    if (fid) {
      url = `${NEYNAR_BASE}/user/bulk?fids=${encodeURIComponent(fid)}`
    } else if (address) {
      url = `${NEYNAR_BASE}/user-by-verification?address=${encodeURIComponent(address)}`
    } else if (username) {
      url = `${NEYNAR_BASE}/user-by-username?username=${encodeURIComponent(username)}`
    } else {
      return res.status(400).json({ error: 'Provide fid, address, or username' })
    }

    const r = await fetch(url, {
      headers: {
        accept: 'application/json',
        api_key: KEY, // Neynar expects this header
      },
    })

    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: `Neynar error: ${text}` })
    }

    const data = await r.json()
    const user = data?.users?.[0] || data?.user || null

    // Helpful caching: profiles don’t change constantly
    // (You can tune these or remove if you want strictly fresh data.)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')

    if (!user) {
      return res.status(404).json({ user: null })
    }

    return res.status(200).json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.display_name ?? null,
        pfp_url: user.pfp?.url ?? null,
        custody_address: user.custody_address ?? null,
        verifications: user.verified_addresses?.eth_addresses ?? [],
      },
    })
  } catch (err) {
    console.error('fc-profile error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
