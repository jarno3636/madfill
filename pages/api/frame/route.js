// pages/api/frame/route.js

import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV2_ABI.json'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { untrustedData } = req.body || {}
    const { fid, buttonIndex, inputText, castId } = untrustedData || {}
    const siteUrl = 'https://madfill.vercel.app'

    const roundId = inputText || '123' // Use inputText from frame input or fallback
    const votedFor = buttonIndex === 1 ? true : false // true = Original, false = Challenger

    console.log(`🗳️ Farcaster Vote: Round ${roundId}, Choice: ${votedFor ? 'Original' : 'Challenger'}`)

    // On-chain vote call
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

    const tx = await ct.vote2(BigInt(roundId), votedFor, {
      value: ethers.parseEther('0.001')
    })
    await tx.wait()

    // Follow-up frame response
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      image: `${siteUrl}/og/vote-confirmed.png`,
      postUrl: `${siteUrl}/api/frame/route`,
      imageAspectRatio: '1.91:1',
      title: '✅ Vote Recorded!',
      description: `You voted for ${votedFor ? 'Original' : 'Challenger'} in Round ${roundId}.`,
      buttons: [
        {
          label: '🎯 View Round',
          action: 'link',
          target: `${siteUrl}/round/${roundId}`,
        },
        {
          label: '📊 Leaderboard',
          action: 'link',
          target: `${siteUrl}/leaderboard`,
        },
      ],
    })
  } catch (err) {
    console.error('Frame vote error:', err)
    return res.status(500).json({ error: 'Frame vote failed' })
  }
}
