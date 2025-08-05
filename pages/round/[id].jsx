// pages/round/[id].jsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function RoundDetailPage() {
  const { query } = useRouter()
  const id = query.id
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [round, setRound]         = useState(null)
  const [address, setAddress]     = useState(null)
  const [status, setStatus]       = useState('')
  const [claimed, setClaimed]     = useState(false)
  const { width, height }         = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(([acct]) => setAddress(acct.toLowerCase()))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_URL),
          new ethers.JsonRpcProvider('https://mainnet.base.org')
        ])
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

        const [onchain, winner, hasClaimed] = await Promise.all([
          contract.rounds(BigInt(id)),
          contract.w2(BigInt(id)),
          contract.c2(BigInt(id))
        ])

        const original = onchain.pA.map(w => ethers.decodeBytes32String(w))
        const challenger = onchain.fA.map(w => ethers.decodeBytes32String(w))

        setRound({
          original,
          challenger,
          votes: {
            original: onchain.vP.toString(),
            challenger: onchain.vF.toString(),
          },
          winner: winner.toLowerCase(),
        })
        setClaimed(hasClaimed)
      } catch (err) {
        console.error(err)
        setError(err.message || 'Failed to load round')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function handleClaim() {
    try {
      setStatus('Claiming…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const ct       = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      await (await ct.claim2(BigInt(id))).wait()
      setClaimed(true)
      setStatus('✅ Prize Claimed!')
    } catch (err) {
      console.error(err)
      setStatus('❌ ' + (err.message || 'Claim failed'))
    }
  }

  function renderCard(words, label, highlight) {
    return (
      <Card className={`bg-slate-900 text-white shadow-lg p-4 ${highlight ? 'ring-4 ring-yellow-400' : ''}`}>
        <CardHeader className="font-bold text-center text-xl">{label}</CardHeader>
        <CardContent className="mt-2 space-x-1 text-center text-yellow-300 font-mono">
          {words.map((w, i) => <span key={i}>{w}</span>)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Layout>
      <Head><title>MadFill Round #{id}</title></Head>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl text-indigo-400 font-bold text-center">Round #{id}</h1>

        {loading && <p className="text-white">Loading round…</p>}
        {error   && <p className="text-red-400">Error: {error}</p>}

        {round && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {renderCard(
                round.original,
                'Original Card',
                Number(round.votes.original) >= Number(round.votes.challenger)
              )}
              {renderCard(
                round.challenger,
                'Challenger Card',
                Number(round.votes.challenger) > Number(round.votes.original)
              )}
            </div>

            <div className="text-white text-center space-y-2">
              <p>🗳️ Votes — Original: <strong>{round.votes.original}</strong> | Challenger: <strong>{round.votes.challenger}</strong></p>
              <p className="break-all">🏆 Winner: <code className="text-green-400">{round.winner}</code></p>

              {address === round.winner && !claimed && (
                <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500">🎁 Claim Prize</Button>
              )}
              {claimed && <p className="text-green-400">✅ Prize Claimed!</p>}
              {status && <p className="text-yellow-300">{status}</p>}
            </div>
            {claimed && <Confetti width={width} height={height} />}          
          </>
        )}
      </main>
      <Footer />
    </Layout>
  )
}
