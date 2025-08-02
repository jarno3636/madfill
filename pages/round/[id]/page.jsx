// app/round/[id]/page.tsx
"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories } from '@/data/templates'
import { Button } from '@/components/ui/button'
import { useAccount } from 'wagmi'

export default function RoundPage() {
  const { id } = useParams()
  const { address: connectedAddress } = useAccount()
  const [roundInfo, setRoundInfo] = useState(null)
  const [winnerWord, setWinnerWord] = useState('')
  const [roundName, setRoundName] = useState('')
  const [isWinner, setIsWinner] = useState(false)
  const [claimStatus, setClaimStatus] = useState('')

  useEffect(() => {
    if (!id) return

    const loadRound = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS!, abi, provider)
        const round = await contract.rounds(BigInt(id))

        const wordBytes = await contract.winningWord(BigInt(id))
        const word = ethers.decodeBytes32String(wordBytes)

        const savedName = localStorage.getItem(`madfill-roundname-${id}`) || `Round #${id}`

        setRoundInfo(round)
        setWinnerWord(word)
        setRoundName(savedName)
        setIsWinner(round.winner.toLowerCase() === connectedAddress?.toLowerCase())
      } catch (err) {
        console.error('Failed to load round', err)
      }
    }
    loadRound()
  }, [id, connectedAddress])

  const handleClaim = async () => {
    try {
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS!, abi, signer)
      const tx = await ct.claim(BigInt(id))
      setClaimStatus('⏳ Claiming...')
      await tx.wait()
      setClaimStatus('✅ Prize claimed!')
    } catch (err: any) {
      setClaimStatus('❌ ' + (err.message || err))
    }
  }

  const shareText = encodeURIComponent(`Check out the winning word for ${roundName} on MadFill 🧠 → ${winnerWord}`)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 text-white space-y-8">
        <Card className="bg-gradient-to-tr from-indigo-900 to-purple-900 shadow-xl">
          <CardHeader>
            <h2 className="text-xl font-bold">🏆 {roundName}</h2>
            {roundInfo?.winner && (
              <p className="text-sm text-slate-300">
                Winner:{' '}
                <a
                  href={`https://warpcast.com/${roundInfo.winner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {roundInfo.winner}
                </a>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">🧾 Winning Word: <strong className="text-pink-400">{winnerWord}</strong></p>

            <div className="flex flex-wrap gap-3">
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}`}
                target="_blank"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                🐦 Share on Twitter
              </a>
              <a
                href={`https://warpcast.com/~/compose?text=${shareText}`}
                target="_blank"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded"
              >
                🌀 Share on Farcaster
              </a>
              {roundInfo?.winner && (
                <a
                  href={`https://warpcast.com/${roundInfo.winner}`}
                  target="_blank"
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  💬 Message Winner
                </a>
              )}
              {isWinner && (
                <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500">
                  🎁 Claim Prize
                </Button>
              )}
              {claimStatus && <p className="text-sm mt-2">{claimStatus}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
