// pages/api/frame/route.js
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // FillInStoryV3 (env wins)

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'

// Default vote fee if env not provided: 0.0005 ETH
const DEFAULT_VOTE_FEE_WEI = ethers.parseUnits('0.0005', 18)
const VOTE_FEE_WEI =
  (process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI && BigInt(process.env.NEXT_PUBLIC_POOL2_VOTE_FEE_WEI)) ||
  DEFAULT_VOTE_FEE_WEI

// tiny buffer to avoid rounding reverts
const VOTE_FEE_WITH_BUFFER = (VOTE_FEE_WEI * 1005n) / 1000n

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Body can be JSON or string; normalize
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { untrustedData } = body
    const { fid, buttonIndex, inputText } = untrustedData || {}

    // Button mapping (Frames index is 1-based):
    // 1 => Original, 2 => Challenger
    const voteChallenger = Number(buttonIndex) === 2

    // Interpret input as Pool2 ID by default.
    // You can also allow "p2:123", "challenge:123", or plain "123".
    const raw = String(inputText || '').trim()
    const parsed =
      raw.match(/p2:(\d+)/i)?.[1] ||
      raw.match(/challenge:(\d+)/i)?.[1] ||
      raw.match(/^(\d+)$/)?.[1] ||
      null

    if (!parsed) {
      return res.status(400).json({
        title: '❌ Invalid Input',
        description: 'Provide a valid Challenge (Pool2) ID, e.g., "123" or "p2:123".',
        image: 'https://madfill.vercel.app/og/error.PNG',
        imageAspectRatio: '1.91:1',
        buttons: [
          { label: '🔁 Try Again', action: 'post' },
          { label: '🏠 MadFill', action: 'link', target: 'https://madfill.vercel.app' },
        ],
      })
    }

    const pool2Id = BigInt(parsed)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://madfill.vercel.app'
    console.log(`📥 Frame Vote — Pool2: ${pool2Id}, User FID: ${fid}, Vote: ${voteChallenger ? 'Challenger' : 'Original'}`)

    // On-chain vote using FillInStoryV3
    const provider = new ethers.JsonRpcProvider(BASE_RPC)
    const pk = process.env.PRIVATE_KEY
    if (!pk) throw new Error('Server PRIVATE_KEY is not set')
    const signer = new ethers.Wallet(pk, provider)
    const ct = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)

    // V3 signature: votePool2(uint256 id, bool voteChallenger) payable
    const tx = await ct.votePool2(pool2Id, voteChallenger, { value: VOTE_FEE_WITH_BUFFER })
    const rc = await tx.wait()

    console.log('✅ Vote tx', rc?.hash)

    // Result visuals
    const imagePath = voteChallenger
      ? `${siteUrl}/og/CHALLENGER_CONFIRMED.PNG`
      : `${siteUrl}/og/VOTE_CONFIRMED.PNG`

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      title: '✅ Vote Recorded!',
      description: `You voted for ${voteChallenger ? 'Challenger' : 'Original'} in Challenge ${pool2Id}.`,
      image: imagePath,
      imageAspectRatio: '1.91:1',
      buttons: [
        {
          label: '🎯 View Round',
          action: 'link',
          // We don’t have round id in the frame input, but most folks encode Pool2->Round mapping in UI.
          // If you want the exact Round link here, pass it into inputText as "p2:123:round:456" and parse above.
          target: `${siteUrl}/vote`,
        },
        {
          label: '📊 Vote More',
          action: 'link',
          target: `${siteUrl}/vote`,
        },
      ],
    })
  } catch (err) {
    console.error('❌ Frame vote error:', err)
    return res.status(500).json({
      title: '❌ Vote Failed',
      description: (err?.shortMessage || err?.reason || err?.message || 'There was an issue submitting your vote.').toString().slice(0, 140),
      image: 'https://madfill.vercel.app/og/error.PNG',
      imageAspectRatio: '1.91:1',
      buttons: [
        { label: '🔁 Try Again', action: 'post' },
        { label: '🏠 MadFill', action: 'link', target: 'https://madfill.vercel.app' },
      ],
    })
  }
}
