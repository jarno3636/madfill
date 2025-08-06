export async function fetchFarcasterProfile(fid) {
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        'api_key': process.env.NEYNAR_API_KEY,
      }
    })

    const json = await res.json()
    const user = json.users?.[0]

    return user
      ? {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          pfp_url: user.pfp?.url || null,
        }
      : null
  } catch (err) {
    console.warn('❌ Failed to fetch Farcaster profile:', err)
    return null
  }
}
