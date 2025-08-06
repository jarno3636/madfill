export async function fetchFarcasterProfile(fid) {
  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/user/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY || '',
      },
      body: JSON.stringify({ fids: [parseInt(fid)] }),
    })

    const json = await res.json()
    const user = json.users?.[0]

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfp_url: user.pfp_url,
    }
  } catch (e) {
    console.error('❌ Failed to fetch Farcaster profile:', e)
    return null
  }
}
