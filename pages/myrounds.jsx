// pages/myrounds.jsx
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Link from 'next/link'
import Countdown from '@/components/Countdown'
import { fetchFarcasterProfile } from '@/lib/neynar'

export default function MyRounds() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimedId, setClaimedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [profile, setProfile] = useState(null)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accts => setAddress(accts[0]))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    async function loadProfile() {
      const fid = localStorage.getItem('fc_fid')
      if (fid) {
        const p = await fetchFarcasterProfile(fid)
        setProfile(p)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    if (!address) return
    setLoading(true)

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

        const [poolCount, entryIds, votes] = await Promise.all([
          ct.pool1Count(),
          ct.getUserEntries(address),
          ct.getUserVotes(address)
        ])

        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=base&vs_currencies=usd')
        const basePrice = (await priceRes.json()).base.usd

        const result = []

        for (let i = 1; i <= poolCount; i++) {
          const info = await ct.getPool1Info(i)
          const participants = info[6]
          const deadline = Number(info[4]) * 1000
          const winner = info[7]
          const claimed = info[8]
          const poolBalance = Number(info[9]) / 1e18
          const isWinner = winner?.toLowerCase() === address.toLowerCase()
          const userInPool = participants.includes(address)
          const voted = votes.includes(BigInt(i))
          const userInVote = voted && !userInPool && !isWinner

          if (userInPool || isWinner || userInVote) {
            const usd = (poolBalance * basePrice).toFixed(2)

            const winnerProfile = winner
              ? await fetchFarcasterProfile(winner)
              : null

            result.push({
              id: i,
              name: localStorage.getItem(`madfill-roundname-${i}`) || info[0] || 'Untitled',
              usd,
              base: poolBalance.toFixed(4),
              deadline,
              isWinner,
              claimed,
              winnerAddress: winner,
              voted,
              userInVote,
              winnerProfile
            })
          }
        }

        setRounds(result)
      } catch (err) {
        console.error('Error loading My Rounds:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [address])

  async function handleClaim(id) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await ct.claimPool1(BigInt(id))
      await tx.wait()
      setClaimedId(id)
      setTimeout(() => setClaimedId(null), 3000)
      setRounds(rs => rs.map(r => (r.id === id ? { ...r, claimed: true } : r)))
    } catch (err) {
      console.error('Claim failed:', err)
      alert('❌ Error claiming prize')
    }
  }

  function filteredSortedRounds() {
    let rs = [...rounds]
    if (filter === 'unclaimed') rs = rs.filter(r => r.isWinner && !r.claimed)
    else if (filter === 'won') rs = rs.filter(r => r.isWinner)
    if (sortBy === 'oldest') rs.sort((a, b) => a.id - b.id)
    else if (sortBy === 'prize') rs.sort((a, b) => parseFloat(b.usd) - parseFloat(a.usd))
    else rs.sort((a, b) => b.id - a.id)
    return rs
  }

  return (
    <Layout>
      <Head>
        <title>My Rounds | MadFill</title>
        {profile && <meta name="fc:creator" content={`@${profile.username}`} />}
      </Head>

      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">🏆 My Rounds</h2>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-white">
          <div>
            <label className="mr-2">Filter:</label>
            <select className="bg-slate-800 border p-1 rounded" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="unclaimed">Unclaimed Wins</option>
              <option value="won">Wins Only</option>
            </select>
          </div>
          <div>
            <label className="mr-2">Sort by:</label>
            <select className="bg-slate-800 border p-1 rounded" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="prize">Prize (USD)</option>
            </select>
          </div>
        </div>

        {loading && <p className="text-white">Loading your rounds…</p>}

        {!loading && filteredSortedRounds().length === 0 && (
          <p className="text-white">No rounds to show based on selected filter.</p>
        )}

        {filteredSortedRounds().map(r => {
          const baseLink = `https://madfill.vercel.app/round/${r.id}`
          const text = encodeURIComponent(`I just played MadFill Round #${r.id}! 🧠\nCheck it out: ${baseLink}`)
          return (
            <Card key={r.id} className="mb-4 bg-slate-800 text-white shadow-xl border border-indigo-700 rounded-lg">
              <CardHeader className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {r.winnerProfile?.pfp_url && (
                    <img src={r.winnerProfile.pfp_url} alt="avatar" className="w-8 h-8 rounded-full border border-white" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg">#{r.id} — {r.name}</h3>
                    <p className="text-sm text-indigo-300">
                      💰 {r.base} BASE (${r.usd})
                    </p>
                  </div>
                </div>
                <Link href={`/round/${r.id}`} className="text-indigo-400 underline text-sm">🔍 View</Link>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <p>⏰ Ends in: <Countdown endTime={r.deadline} /></p>

                {r.isWinner && !r.claimed && (
                  <Button onClick={() => handleClaim(r.id)} className="bg-green-600 hover:bg-green-500 mt-2">
                    🎉 Claim Prize
                  </Button>
                )}
                {r.isWinner && r.claimed && (
                  <p className="text-green-400 font-semibold">✅ Prize Claimed</p>
                )}
                {r.userInVote && (
                  <p className="text-yellow-400 font-medium">🗳️ You voted in this round</p>
                )}
                {!r.isWinner && !r.userInVote && (
                  <p className="text-slate-300">🎮 You participated in this round</p>
                )}

                {/* Optional future: show sticker/preview */}
                <div className="mt-2 text-slate-400 text-xs italic">🖼️ Card preview coming soon…</div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <a href={`https://twitter.com/intent/tweet?text=${text}`} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-sm">
                    🐦 Share
                  </a>
                  <a href={`https://warpcast.com/~/compose?text=${text}`} target="_blank" rel="noreferrer" className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white text-sm">
                    🌀 Cast
                  </a>
                  <a href={`https://warpcast.com/~/compose?text=${text}&embeds[]=${baseLink}`} target="_blank" rel="noreferrer" className="bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1 rounded text-white text-sm">
                    📚 Story
                  </a>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {claimedId && <Confetti width={width} height={height} />}
      </div>
    </Layout>
  )
}
