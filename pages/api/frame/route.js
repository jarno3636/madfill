import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { untrustedData } = req.body || {}
    const { fid, buttonIndex, inputText, castId } = untrustedData || {}

    const siteUrl = 'https://madfill.vercel.app'
    const roundId = inputText?.trim() || '1'
    const votedForOriginal = buttonIndex === 1

    console.log(`📥 Frame Vote — Round: ${roundId}, User: ${fid}, Voted: ${votedForOriginal ? 'Original' : 'Challenger'}`)

    // On-chain vote using FillInStoryV3
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

    const tx = await ct.vote2(BigInt(roundId), votedForOriginal, {
      value: ethers.parseEther('0.001'),
    })
    await tx.wait()

    // Pick a result image
    const imagePath = votedForOriginal
      ? `${siteUrl}/og/VOTE_CONFIRMED.PNG`
      : `${siteUrl}/og/CHALLENGER_CONFIRMED.PNG`

    // Build response frame
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      title: '✅ Vote Recorded!',
      description: `You voted for ${votedForOriginal ? 'Original' : 'Challenger'} in Round ${roundId}.`,
      image: imagePath,
      imageAspectRatio: '1.91:1',
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
    console.error('❌ Frame vote error:', err)
    return res.status(500).json({
      title: '❌ Vote Failed',
      description: 'There was an issue submitting your vote.',
      image: 'https://madfill.vercel.app/og/error.PNG',
      imageAspectRatio: '1.91:1',
      buttons: [
        {
          label: '🔁 Try Again',
          action: 'post',
        },
        {
          label: '🏠 MadFill',
          action: 'link',
          target: 'https://madfill.vercel.app',
        },
      ],
    })
  }
}
