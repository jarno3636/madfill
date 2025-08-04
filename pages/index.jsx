import React, { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
// import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories } from '../data/templates'
import Layout from '@/components/Layout'
// import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

export default function Home() {
  const [status, setStatus] = useState('')
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(1)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  // const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  // fetch deadline
  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    contract.rounds(BigInt(roundId))
      .then(info => setDeadline(info.sd.toNumber()))
      .catch(() => setDeadline(null))
  }, [roundId])

  // fetch recent winners
  useEffect(() => {
    async function loadWinners() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
      const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
      setRecentWinners(
        events.slice(-5).reverse().map(e => ({
          roundId: e.args.id.toNumber(),
          winner: e.args.winner,
        }))
      )
    }
    loadWinners().catch(console.error)
  }, [])

  async function handleUnifiedSubmit() {
    try {
      setBusy(true)
      setStatus('')
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      let newId = roundId
      if (!newId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(
          tpl.blanks,
          ethers.parseEther(ENTRY_FEE),
          BigInt(duration * 86400)
        )
        await tx.wait()
        const ev = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = ev[ev.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
        // setShowConfetti(true)
      }

      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)
      const tx2 = await ct.submitPaid(
        BigInt(newId),
        Number(blankIndex),
        data,
        { value: ethers.parseEther(ENTRY_FEE) }
      )
      await tx2.wait()

      setStatus(`✅ Entry submitted!`)
      const preview = tpl.parts.map((p,i)=>
        i<tpl.blanks
          ? `${p}${i===Number(blankIndex)?word:'____'}`
          : p
      ).join('')
      setShareText(encodeURIComponent(
        `I just entered on-chain: ${preview}\nPlay: https://madfill.vercel.app`
      ))
    } catch (e) {
      const msg = (e.message||'').toLowerCase()
      if (msg.includes('denied')) {
        setStatus('❌ Transaction cancelled.')
      } else if (msg.includes('execution reverted')||msg.includes('require(false)')) {
        setStatus('❌ Transaction failed on-chain.')
      } else {
        setStatus('❌ ' + (e.message||'Unknown error'))
      }
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-8 text-center border-b-2 ${
      active ? 'border-white' : 'border-slate-400'
    } cursor-pointer mx-1`

  return (
    <Layout>
      <Head><title>MadFill</title></Head>

      {/* Info Card */}
      <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white rounded-xl p-4">
        <CardHeader><h2 className="text-xl font-bold">🎮 What Is MadFill?</h2></CardHeader>
        <CardContent>
          <p>Create round (gas only) then pay <strong>{ENTRY_FEE} BASE</strong> per entry. Winner takes the pool.</p>
        </CardContent>
      </Card>

      {/* Setup */}
      <Card className="bg-slate-800 text-white rounded-xl p-4">
        {/* selectors, template preview, etc. unchanged… */}

        <Button
          onClick={handleUnifiedSubmit}
          disabled={!word || busy}
          className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500"
        >
          {!roundId ? '🚀 Create Round' : '✏️ Submit Entry'}
        </Button>

        {status && <p className="mt-2 text-sm">{status}</p>}

        {/* guarded share UI */}
        {shareText && !busy && (
          <div className="mt-4 space-y-2">
            <p className="font-semibold">📣 Share:</p>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}`}
              target="_blank" rel="noopener noreferrer"
              className="block bg-blue-600 px-4 py-2 rounded"
            >🐦 Twitter</a>
            <a
              href={`https://warpcast.com/~/compose?text=${shareText}`}
              target="_blank" rel="noopener noreferrer"
              className="block bg-purple-600 px-4 py-2 rounded"
            >🌀 Farcaster</a>
          </div>
        )}
      </Card>
    </Layout>
  )
}
