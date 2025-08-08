// pages/api/fc-profile.js
import { NextResponse } from 'next/server'

const NEYNAR_BASE = 'https://api.neynar.com/v2/farcaster'
const KEY = process.env.NEYNAR_API_KEY // <-- server-side ONLY

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!KEY) {
    return res.status(500).json({ error: 'Missing NEYNAR_API_KEY on server' })
  }

  try {
    const { fid, address, username } = req.query || {}
    let url = null

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
      headers: { 'accept': 'application/json', 'api_key': KEY },
      // Neynar expects `api_key` header (not Authorization)
    })

    if (!r.ok) {
      const text = await r.text()
      return res.status(r.status).json({ error: `Neynar error: ${text}` })
    }

    const data = await r.json()
    // Normalize different shapes
    const user =
      data?.users?.[0] ||
      data?.user ||
      null

    if (!user) {
      return res.status(404).json({ user: null })
    }

    return res.status(200).json({
      user: {
        fid: user.fid ?? null,
        username: user.username ?? null,
        displayName: user.display_name ?? null,
        pfp_url: user.pfp?.url ?? null,
        // a couple handy extras if present:
        custody_address: user.custody_address ?? null,
        verifications: user.verified_addresses?.eth_addresses ?? [],
      }
    })
  } catch (err) {
    console.error('fc-profile error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
