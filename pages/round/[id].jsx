// pages/round/[id].jsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { Alchemy, Network } from 'alchemy-sdk'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryFull.json'
import { categories } from '@/data/templates'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

export default function RoundDetailPage() {
  const { query } = useRouter()
  const id = query.id
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [data, setData]           = useState(null)
  const [address, setAddress]     = useState(null)
  const [claimed, setClaimed]     = useState(false)
  const [status, setStatus]       = useState('')
  const { width, height }         = useWindowSize()

  // ask user to connect wallet
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(a => setAddress(a[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY
        const RPC_URL     = process.env.NEXT_PUBLIC_ALCHEMY_URL
        const ADDRESS     = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        if (!ALCHEMY_KEY) throw new Error('Missing NEXT_PUBLIC_ALCHEMY_KEY')
        if (!RPC_URL)     throw new Error('Missing NEXT_PUBLIC_ALCHEMY_URL')
        if (!ADDRESS)     throw new Error('Missing NEXT_PUBLIC_FILLIN_ADDRESS')

        // 1) init Alchemy (handles paging under the hood)
        const alchemy = new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE })

        // 2) provider+contract for decoding & calls
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const ct       = new ethers.Contract(ADDRESS, abi, provider)

        // 3) fetch on-chain state
        const [ rnd, winnerAddr, hasClaimed ] = await Promise.all([
          ct.rounds(BigInt(id)),
          ct.w2(BigInt(id)),
          ct.c2(BigInt(id))
        ])

        // 4) figure out which template user chose (we stored these locally)
        const tplIx = parseInt(localStorage.getItem(`madfill-tplIdx-${id}`)  || '0', 10)
        const catIx = parseInt(localStorage.getItem(`madfill-catIdx-${id}`)  || '0', 10)
        const tpl   = categories[catIx].templates[tplIx]

        // 5) fetch all SubmitPaid & SubmitFree events for this round
        const topicPaid = ct.interface.getEventTopic('SubmitPaid')
        const topicFree = ct.interface.getEventTopic('SubmitFree')

        const [ paidLogs, freeLogs ] = await Promise.all([
          alchemy.core.getLogs({
            fromBlock: Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502,
            toBlock:   'latest',
            address:   ADDRESS,
            topics:    [ topicPaid, ethers.id(id) ]
          }),
          alchemy.core.getLogs({
            fromBlock: Number(process.env.NEXT_PUBLIC_START_BLOCK) || 33631502,
            toBlock:   'latest',
            address:   ADDRESS,
            topics:    [ topicFree, ethers.id(id) ]
          })
        ])

        // decode args
        const paidArgs = paidLogs.map(l => ct.interface.parseLog(l).args)
        const freeArgs = freeLogs.map(l => ct.interface.parseLog(l).args)

        // 6) build original vs challenger word arrays
        //    assume the very first paid entry is original,
        //    everything else (paid+free) are challengers:
        const allSubs    = [...paidArgs, ...freeArgs]
        const originalEv = paidArgs[0]
        const challengerEvs = allSubs.filter(e => e !== originalEv)

        const originalWords   = originalEv
          ? [ ethers.decodeBytes32String(originalEv[2]) ]
          : []
        const challengerWords = challengerEvs.map(e =>
          ethers.decodeBytes32String(e[2])
        )

        // 7) update state
        setClaimed(hasClaimed)
        setData({
          tpl,
          original:    originalWords,
          challenger:  challengerWords,
          votes: {
            original:   rnd.vP.toString(),
            challenger: rnd.vF.toString(),
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
      const ct       = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      await (await ct.claim2(BigInt(id))).wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message||'Claim failed'))
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
          {parts.map((part,i) => (
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

      {data && (
        <>
          <div className="grid md:grid-cols-2 gap-6 my-6">
            {renderCard(
              data.tpl.parts,
              data.original,
              'Original Card',
              Number(data.votes.original) >= Number(data.votes.challenger)
            )}
            {renderCard(
              data.tpl.parts,
              data.challenger,
              'Challenger Card',
              Number(data.votes.challenger) > Number(data.votes.original)
            )}
          </div>

          <div className="text-white space-y-2">
            <p>
              🗳️ Votes — Original: <strong>{data.votes.original}</strong> | Challenger:{' '}
              <strong>{data.votes.challenger}</strong>
            </p>
            <p>
              🏆 Winning address:{' '}
              <code className="text-green-400">{data.winner}</code>
            </p>

            {address?.toLowerCase() === data.winner && !claimed && (
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
