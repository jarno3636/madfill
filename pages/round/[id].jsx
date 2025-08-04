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
  const { query } = useRouter()
  const id = query.id
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [roundData, setRoundData] = useState(null)
  const [address, setAddress]     = useState(null)
  const [status, setStatus]       = useState('')
  const [claimed, setClaimed]     = useState(false)
  const { width, height }         = useWindowSize()

  // ask user to connect wallet
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accts => setAddress(accts[0]))
        .catch(console.error)
    }
  }, [])

  // load round details & submissions
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        // 1) provider & contract
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const provider = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )

        // 2) fetch on-chain state, winner, claim flag
        const [ onchain, winnerAddr, hasClaimed ] = await Promise.all([
          ct.rounds(BigInt(id)),
          ct.w2(BigInt(id)),
          ct.c2(BigInt(id)),
        ])

        // 3) get chosen template indices from localStorage
        const tplIx = Number(localStorage.getItem(`madfill-tplIdx-${id}`) || 0)
        const catIx = Number(localStorage.getItem(`madfill-catIdx-${id}`) || 0)
        const tpl   = categories[catIx].templates[tplIx]

        // 4) fetch all submissions (paid vs free)
        const subs = await ct.getSubmissions(BigInt(id))
        const originalSub     = subs.find(s => s.paid)
        const challengerSubs  = subs.filter(s => !s.paid)

        // 5) decode words into strings
        const original = originalSub
          ? [ ethers.decodeBytes32String(originalSub.word) ]
          : []
        const challenger = challengerSubs.map(s =>
          ethers.decodeBytes32String(s.word)
        )

        // 6) update state
        setClaimed(hasClaimed)
        setRoundData({
          tpl,
          original,
          challenger,
          votes: {
            original:   onchain.vP.toString(),
            challenger: onchain.vF.toString(),
          },
          winner: winnerAddr.toLowerCase(),
        })
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load round')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  // claim button handler
  async function handleClaim() {
    try {
      setStatus('Claiming…')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      await (await ct.claim2(BigInt(id))).wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || 'Claim failed'))
    }
  }

  // card renderer
  function renderCard(parts, words, title, highlight) {
    return (
      <Card
        className={`bg-slate-900 text-white shadow-xl overflow-hidden transform transition
          ${highlight ? 'scale-105 ring-4 ring-yellow-400' : ''}`}
      >
        <CardHeader className="bg-slate-800 text-center font-bold">{title}</CardHeader>
        <CardContent className="p-4 text-center font-mono text-lg">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < words.length && (
                <span className="text-yellow-300">{words[i]}</span>
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

      {loading && <p className="text-white">Loading round…</p>}
      {error   && <p className="text-red-400">Error: {error}</p>}

      {roundData && (
        <>
          <div className="grid md:grid-cols-2 gap-6 my-6">
            {renderCard(
              roundData.tpl.parts,
              roundData.original,
              'Original Card',
              Number(roundData.votes.original) >= Number(roundData.votes.challenger)
            )}
            {renderCard(
              roundData.tpl.parts,
              roundData.challenger,
              'Challenger Card',
              Number(roundData.votes.challenger) > Number(roundData.votes.original)
            )}
          </div>

          <div className="text-white space-y-2">
            <p>
              🗳️ Votes — Original: <strong>{roundData.votes.original}</strong> | Challenger:{' '}
              <strong>{roundData.votes.challenger}</strong>
            </p>
            <p>
              🏆 Winning address:{' '}
              <code className="text-green-400">{roundData.winner}</code>
            </p>

            {address?.toLowerCase() === roundData.winner && !claimed && (
              <Button onClick={handleClaim} className="bg-green-600 hover:bg-green-500">
                🎁 Claim Prize
              </Button>
            )}
            {claimed && <p className="text-green-400">✅ Prize Claimed!</p>}
            {status  && <p className="text-yellow-300">{status}</p>}
          </div>

          {claimed && <Confetti width={width} height={height} />}
        </>
      )}
    </Layout>
  )
}
