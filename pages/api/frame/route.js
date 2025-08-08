// pages/api/frame/route.js
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // env wins

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

// default vote fee: 0.0005 ETH (override with NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)
const DEFAULT_VOTE_FEE_WEI = ethers.parseUnits('0.0005', 18)
const VOTE_FEE_WEI =
  (process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI && BigInt(process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)) ||
  DEFAULT_VOTE_FEE_WEI
const VOTE_FEE_WITH_BUFFER = (VOTE_FEE_WEI * 1005n) / 1000n

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'

  try {
    // Frames body OR plain JSON string
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { untrustedData } = body

    // Query fallbacks (works with the frame.js post targets)
    const { id: qId, kind: qKind, vote: qVote } = req.query || {}

    // Pull from Frames (buttonIndex starts at 1): 1=Original, 2=Challenger
    const buttonIndex = Number(untrustedData?.buttonIndex || 0)
    const fromButtons = buttonIndex === 1 || buttonIndex === 2
    const voteChallenger =
      fromButtons ? (buttonIndex === 2) : (String(qVote).toLowerCase() === 'challenger')

    // Identify target
    let kind = (untrustedData?.inputTextKind || qKind || 'pool2').toLowerCase()
    let rawId = (untrustedData?.inputText || qId || '').toString().trim()

    // Allow "123", "p2:123", "round:123"
    const matchP2 = rawId.match(/p2:(\d+)/i)
    const matchRound = rawId.match(/round:(\d+)/i)
    if (matchP2) { kind = 'pool2'; rawId = matchP2[1] }
    if (matchRound) { kind = 'round'; rawId = matchRound[1] }

    if (!rawId || isNaN(rawId)) {
      return res.status(400).json({
        title: '❌ Invalid Input',
        description: 'Provide a valid id (e.g. p2:123 or round:45).',
        image: `${siteUrl}/og/error.PNG`,
        imageAspectRatio: '1.91:1',
        buttons: [
          { label: '🔁 Try Again', action: 'post' },
          { label: '🏠 MadFill', action: 'link', target: siteUrl },
        ],
      })
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC)
    const pk = process.env.PRIVATE_KEY
    if (!pk) throw new Error('Server PRIVATE_KEY is not set')
    const signer = new ethers.Wallet(pk, provider)
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

    // If kind=round, resolve the most recent *active* Pool2 for that round
    let pool2Id
    if (kind === 'pool2') {
      pool2Id = BigInt(rawId)
    } else {
      const roundId = BigInt(rawId)
      const p2Count = Number(await ct.pool2Count())
      let found = null
      // scan newest -> oldest until we find pool2.originalPool1Id == roundId && !claimed
      for (let id = p2Count; id >= 1; id--) {
        const info = await ct.getPool2Info(BigInt(id))
        const originalPool1Id = Number(info[0])
        const claimed = info[6]
        if (originalPool1Id === Number(roundId) && !claimed) {
          found = id
          break
        }
      }
      if (!found) {
        return res.status(404).json({
          title: '😴 No Active Challenge',
          description: `Round ${roundId} has no open challenge to vote on.`,
          image: `${siteUrl}/og/empty.PNG`,
          imageAspectRatio: '1.91:1',
          buttons: [
            { label: '🚀 Start a Challenger', action: 'link', target: `${siteUrl}/challenge` },
            { label: '🔎 View Round', action: 'link', target: `${siteUrl}/round/${roundId}` },
          ],
        })
      }
      pool2Id = BigInt(found)
    }

    // Vote on Pool2
    const tx = await ct.votePool2(pool2Id, Boolean(voteChallenger), { value: VOTE_FEE_WITH_BUFFER })
    const rc = await tx.wait()
    console.log('✅ votePool2 tx:', rc?.hash)

    const img = voteChallenger
      ? `${siteUrl}/og/CHALLENGER_CONFIRMED.PNG`
      : `${siteUrl}/og/VOTE_CONFIRMED.PNG`

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      title: '✅ Vote Recorded!',
      description: `You voted for ${voteChallenger ? 'Challenger' : 'Original'} in Challenge ${pool2Id}.`,
      image: img,
      imageAspectRatio: '1.91:1',
      buttons: [
        { label: '📊 More Votes', action: 'link', target: `${siteUrl}/vote` },
        { label: '🏠 MadFill', action: 'link', target: siteUrl },
      ],
    })
  } catch (err) {
    console.error('❌ Frame vote error:', err)
    return res.status(500).json({
      title: '❌ Vote Failed',
      description: (err?.shortMessage || err?.reason || err?.message || 'There was an issue submitting your vote.').toString().slice(0, 140),
      image: `${siteUrl}/og/error.PNG`,
      imageAspectRatio: '1.91:1',
      buttons: [
        { label: '🔁 Try Again', action: 'post' },
        { label: '🏠 MadFill', action: 'link', target: siteUrl },
      ],
    })
  }
}
