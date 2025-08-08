// lib/neynar.js

function isHexAddress(x) {
  return typeof x === 'string' && /^0x[a-fA-F0-9]{40}$/.test(x)
}
function isNumeric(x) {
  return typeof x === 'string' && /^[0-9]+$/.test(x)
}

/**
 * Fetch a Farcaster profile by fid, EVM address, or username.
 * Returns: { fid, username, displayName, pfp_url } | null
 */
export async function fetchFarcasterProfile(idOrAddrOrUsername) {
  try {
    const params = new URLSearchParams()
    if (isHexAddress(idOrAddrOrUsername)) {
      params.set('address', idOrAddrOrUsername)
    } else if (isNumeric(idOrAddrOrUsername)) {
      params.set('fid', idOrAddrOrUsername)
    } else if (typeof idOrAddrOrUsername === 'string' && idOrAddrOrUsername.trim()) {
      // fallback treat as username
      params.set('username', idOrAddrOrUsername.replace(/^@/, ''))
    } else {
      return null
    }

    const res = await fetch(`/api/fc-profile?${params.toString()}`)
    if (!res.ok) return null
    const json = await res.json()
    const u = json?.user
    if (!u) return null

    return {
      fid: u.fid ?? null,
      username: u.username ?? null,
      displayName: u.displayName ?? null,
      pfp_url: u.pfp_url ?? null,
    }
  } catch (err) {
    console.warn('Failed to fetch Farcaster profile:', err)
    return null
  }
}
