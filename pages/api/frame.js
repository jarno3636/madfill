// pages/api/frame.js
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' }, // Farcaster sends application/json
  },
}

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // Base V3

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

// default vote fee: 0.0005 ETH (override with NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)
const DEFAULT_VOTE_FEE_WEI = ethers.parseUnits('0.0005', 18)
const VOTE_FEE_WEI =
  (process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI && BigInt(process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)) ||
  DEFAULT_VOTE_FEE_WEI
const VOTE_FEE_WITH_BUFFER = (VOTE_FEE_WEI * 1005n) / 1000n

function noCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

function json(res, code, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  noCache(res)
  return res.status(code).end(JSON.stringify(data))
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app').replace(/\/+$/, '')
}

function ogUrl(params = {}) {
  const u = new URL('/api/og', siteUrl())
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  }
  return u.toString()
}

export default async function handler(req, res) {
  // Basic CORS & preflight (safe on Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  const SITE = siteUrl()

  try {
    // Farcaster vNext POST body
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const untrusted = body.untrustedData || {}

    // Allow manual testing via querystring
    const { id: qId, kind: qKind, vote: qVote } = req.query || {}

    // Buttons: 1 = Original, 2 = Challenger
    const buttonIndex = Number(untrusted.buttonIndex || 0)
    const fromButtons = buttonIndex === 1 || buttonIndex === 2
    const voteChallenger = fromButtons
      ? buttonIndex === 2
      : String(qVote || '').toLowerCase() === 'challenger'

    // Target parsing: “123”, “p2:123”, “round:123”
    let kind = String(untrusted.inputTextKind || qKind || 'pool2').toLowerCase()
    let rawId = String(untrusted.inputText || qId || '').trim()
    const mP2 = rawId.match(/p2:(\d+)/i)
    const mRound = rawId.match(/round:(\d+)/i)
    if (mP2) { kind = 'pool2'; rawId = mP2[1] }
    if (mRound) { kind = 'round'; rawId = mRound[1] }

    if (!rawId || isNaN(Number(rawId))) {
      return json(res, 400, {
        // vNext JSON keys:
        image: ogUrl({ screen: 'error', title: 'Invalid Input', subtitle: 'Try p2:123 or round:45' }),
        image_aspect_ratio: '1.91:1',
        post_url: `${SITE}/api/frame`,
        buttons: [
          { label: '🔁 Try Again', action: 'post' },
          { label: '🏠 MadFill', action: 'link', target: SITE },
        ],
        // Extras for humans (ignored by renderer)
        title: '❌ Invalid Input',
        description: 'Provide a valid id (e.g., p2:123 or round:45).',
      })
    }

    const pk = process.env.PRIVATE_KEY
    if (!pk) throw new Error('Server PRIVATE_KEY is not set')

    const provider = new ethers.JsonRpcProvider(BASE_RPC, undefined, { staticNetwork: true })
    const signer = new ethers.Wallet(pk, provider)
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

    // If kind=round, resolve latest unclaimed pool2 for that round
    let pool2Id
    if (kind === 'pool2') {
      pool2Id = BigInt(rawId)
    } else {
      const roundId = BigInt(rawId)
      const p2Count = Number(await ct.pool2Count())
      let found = null
      for (let id = p2Count; id >= 1; id--) {
        const info = await ct.getPool2Info(BigInt(id))
        const originalPool1Id = Number(info[0])
        const claimed = Boolean(info[6])
        if (originalPool1Id === Number(roundId) && !claimed) {
          found = id
          break
        }
      }
      if (!found) {
        return json(res, 404, {
          image: ogUrl({ screen: 'vote', title: 'No Active Challenge', subtitle: `Round ${roundId} has none.` }),
          image_aspect_ratio: '1.91:1',
          post_url: `${SITE}/api/frame`,
          buttons: [
            { label: '🚀 Start Challenger', action: 'link', target: `${SITE}/challenge` },
            { label: '🔎 View Round', action: 'link', target: `${SITE}/round/${roundId}` },
          ],
          title: '😴 No Active Challenge',
          description: `Round ${roundId} has no open challenge to vote on.`,
        })
      }
      pool2Id = BigInt(found)
    }

    // Send vote from server signer
    const tx = await ct.votePool2(pool2Id, Boolean(voteChallenger), { value: VOTE_FEE_WITH_BUFFER })
    const rc = await tx.wait()
    console.log('✅ votePool2 hash:', rc?.hash || rc?.transactionHash)

    const img = ogUrl({
      screen: 'vote',
      title: 'Vote Recorded!',
      subtitle: `${voteChallenger ? 'Challenger' : 'Original'} • #${pool2Id}`,
    })

    return json(res, 200, {
      image: img,
      image_aspect_ratio: '1.91:1',
      post_url: `${SITE}/api/frame`,
      buttons: [
        { label: '📊 More Votes', action: 'link', target: `${SITE}/vote` },
        { label: '🏠 MadFill', action: 'link', target: SITE },
      ],
      title: '✅ Vote Recorded!',
      description: `You voted for ${voteChallenger ? 'Challenger' : 'Original'} in Challenge ${String(pool2Id)}.`,
    })
  } catch (err) {
    console.error('❌ Frame vote error:', err)
    return json(res, 500, {
      image: ogUrl({ screen: 'error', title: 'Vote Failed', subtitle: 'Please try again' }),
      image_aspect_ratio: '1.91:1',
      post_url: `${siteUrl()}/api/frame`,
      buttons: [
        { label: '🔁 Try Again', action: 'post' },
        { label: '🏠 MadFill', action: 'link', target: siteUrl() },
      ],
      title: '❌ Vote Failed',
      description: (err?.shortMessage || err?.reason || err?.message || 'Issue submitting your vote.')
        .toString()
        .slice(0, 140),
    })
  }
}
