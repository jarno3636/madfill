// pages/round/[id].jsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import abi from '@/abi/FillInStoryFull.json'
import { categories } from '@/data/templates'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function RoundDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(true)
  const [winner, setWinner] = useState(null)
  const [claimable, setClaimable] = useState(false)
  const [status, setStatus] = useState('')
  const [address, setAddress] = useState(null)
  const [claimed, setClaimed] = useState(false)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => setAddress(accounts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    async function fetchRound() {
      setLoading(true)
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const r = await contract.rounds(id)
        const template = categories[0].templates[0] // update if tracking template id per round

        const winnerAddr = await contract.w2(id)
        const alreadyClaimed = await contract.c2(id)

        setRound({
          id,
          template,
          original: r.pA || [],
          challenger: r.fA || [],
          vP: r.vP.toString(),
          vF: r.vF.toString(),
        })
        setWinner(winnerAddr)
        setClaimed(alreadyClaimed)
        setClaimable(winnerAddr?.toLowerCase() === address?.toLowerCase() && !alreadyClaimed)
      } catch (e) {
        console.error('Failed to load round:', e)
      }
      setLoading(false)
    }
    fetchRound()
  }, [id, address])

  async function handleClaim() {
    try {
      setStatus('Claiming your prize...')
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await contract.claim2(id)
      await tx.wait()
      setStatus('🎉 Prize claimed!')
      setClaimed(true)
    } catch (e) {
      setStatus('❌ ' + (e.message || 'Claim failed'))
    }
  }

  function renderCard(parts, words, title, isWinner) {
    return (
      <Card className={`bg-slate-900 text-white shadow-xl transition transform ${isWinner ? 'border-2 border-yellow-400 scale-105' : ''}`}>
        <CardHeader className="font-bold text-lg text-center">{title}</CardHeader>
        <CardContent className="text-lg px-4 py-2 text-center">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < words.length && (
                <span className="text-yellow-300 font-semibold">{words[i]}</span>
              )}
            </span>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Layout>
      <Head><title>MadFill Round #{id}</title></Head>
      <h1 className="text-3xl font-bold text-white mb-6">📖 Round #{id} Details</h1>

      {loading && <p className="text-white">Loading round...</p>}

      {!loading && round && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {renderCard(round.template.parts, round.original, 'Original Card', Number(round.vP) >= Number(round.vF))}
            {renderCard(round.template.parts, round.challenger, 'Challenger Card', Number(round.vF) > Number(round.vP))}
          </div>

          <div className="mt-6 text-white text-sm">
            <p>Votes — Original: {round.vP} | Challenger: {round.vF}</p>
            {winner && (
              <p className="mt-2">🏆 Winner (voter): <span className="text-green-400">{winner}</span></p>
            )}

            {claimable && !claimed && (
              <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500 mt-4">
                🎁 Claim Your Prize
              </Button>
            )}

            {claimed && (
              <p className="mt-2 text-green-400">✅ Prize Claimed</p>
            )}

            {status && <p className="mt-2 text-yellow-300">{status}</p>}
          </div>

          {status.includes('claimed') && <Confetti width={width} height={height} />} 
        </>
      )}
    </Layout>
  )
}
