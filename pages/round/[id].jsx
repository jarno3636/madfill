// pages/round/[id].jsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import abi from '@/abi/FillInStoryFull.json'
import { categories } from '@/data/templates'

export default function RoundDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function fetchRound() {
      setLoading(true)
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const r = await contract.rounds(id)
        const template = categories[0].templates[0] // update if tracking template id per round
        setRound({
          id,
          template,
          original: r.pA || [],
          challenger: r.fA || [],
        })
      } catch (e) {
        console.error('Failed to load round:', e)
      }
      setLoading(false)
    }
    fetchRound()
  }, [id])

  function renderCard(parts, words, title) {
    return (
      <Card className="bg-slate-900 text-white shadow-xl">
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
        <div className="grid md:grid-cols-2 gap-4">
          {renderCard(round.template.parts, round.original, 'Original Card')}
          {renderCard(round.template.parts, round.challenger, 'Challenger Card')}
        </div>
      )}
    </Layout>
  )
}
