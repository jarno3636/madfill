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

  // connect wallet
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accts => setAddress(accts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        // 1) provider + contract
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const fallback = new ethers.FallbackProvider([
          new ethers.JsonRpcProvider(rpcUrl),
          new ethers.JsonRpcProvider('https://mainnet.base.org'),
        ])
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          fallback
        )

        // 2) read on-chain state
        const [ onchain, winnerAddr, hasClaimed ] = await Promise.all([
          ct.rounds(BigInt(id)),
          ct.w2(BigInt(id)),
          ct.c2(BigInt(id)),
        ])

        // 3) batch-fetch the single Started event for this round
        const deployBlock = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502
        const latestBlock = await fallback.getBlockNumber()
        const BATCH = 500

        async function fetchStarted() {
          const filter = ct.filters.Started()
          for (let start = deployBlock; start <= latestBlock; start += BATCH) {
            const end = Math.min(start + BATCH - 1, latestBlock)
            const logs = await fallback.getLogs({
              address:    ct.address,
              topics:     filter.topics,
              fromBlock:  start,
              toBlock:    end,
            })
            for (let log of logs) {
              const args = ct.interface.parseLog(log).args
              if (args.id.toString() === id) return args
            }
          }
          throw new Error('Started event not found')
        }
        const startArgs = await fetchStarted()

        // 4) pick up the template index & blanks that you stored
        const tplIx = Number(localStorage.getItem(`madfill-tplIdx-${id}`) || 0)
        const catIx = Number(localStorage.getItem(`madfill-catIdx-${id}`) || 0)
        const tpl   = categories[catIx].templates[tplIx]

        // 5) decode words arrays
        const origWords = onchain.pA.map(w => ethers.decodeBytes32String(w))
        const chalWords = onchain.fA.map(w => ethers.decodeBytes32String(w))

        setClaimed(hasClaimed)
        setRoundData({
          tpl,
          original:    origWords,
          challenger:  chalWords,
          votes: {
            original: onchain.vP.toString(),
            challenger: onchain.vF.toString()
          },
          winner: winnerAddr.toLowerCase()
        })
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load round')
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
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await ct.claim2(BigInt(id))
      await tx.wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || 'Claim failed'))
    }
  }

  function renderCard(parts, words, title, highlight) {
    return (
      <Card className={
        `bg-slate-900 text-white shadow-xl overflow-hidden transform transition 
         ${highlight ? 'scale-105 ring-4 ring-yellow-400' : ''}`
      }>
        <CardHeader className="bg-slate-800 text-center font-bold">
          {title}
        </CardHeader>
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
