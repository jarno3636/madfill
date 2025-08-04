import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

export default function Home() {
  // … all your existing state/hooks here …
  const [status, setStatus] = useState('')
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(1)
  const [showConfetti, setShowConfetti] = useState(false)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]
  const [busy, setBusy] = useState(false)

  const durations = [
    { label: '1 Day', value: 1 }, { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 }, { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 }, { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]

  // … your existing useEffects for deadline & recentWinners …

  async function handleUnifiedSubmit() {
    try {
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      setBusy(true)
      setStatus('')
      let newId = roundId

      // — CREATE ROUND (still pops Metamask) —
      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(
          tpl.blanks,
          ethers.parseEther(ENTRY_FEE),
          BigInt(duration * 86400),
          { value: ethers.parseEther(ENTRY_FEE) } // ✅ FEE FIX
        )
        await tx.wait()

        // grab the new ID
        const events = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = events[events.length - 1].args.id.toString()
        setRoundId(newId)

        // set deadline & localStorage
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')

        // confetti
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      }

      // — SUBMIT ENTRY (preview with callStatic, then popup) —
      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)

      // 1️⃣ preview on-chain check
      await ct.callStatic.submitPaid(BigInt(newId), Number(blankIndex), data, {
        value: ethers.parseEther(ENTRY_FEE),
      })

      // 2️⃣ actual transaction
      const tx2 = await ct.submitPaid(BigInt(newId), Number(blankIndex), data, {
        value: ethers.parseEther(ENTRY_FEE),
      })
      await tx2.wait()

      setStatus(`✅ Round ${newId} entry submitted!`)

      // build share text
      const preview = tpl.parts.map((part, i) =>
        i < tpl.blanks
          ? `${part}${i === Number(blankIndex) ? word : '____'}`
          : part
      ).join('')
      const share = encodeURIComponent(
        `I just entered a hilarious on-chain word game! 🧠\n\n${preview}\n\nPlay here: https://madfill.vercel.app`
      )
      setShareText(share)

    } catch (e) {
      // ✅ FRIENDLY ERROR
      let friendly = '❌ Transaction failed on-chain.'
      if (e?.reason) {
        // ethers v6 revert reason
        friendly = `❌ ${e.reason}`
      } else if (e.error?.message) {
        // nested error
        friendly = `❌ ${e.error.message}`
      } else if (e.message) {
        // fallback
        friendly = `❌ ${e.message}`
      }
      setStatus(friendly)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <Layout>
      <Head><title>MadFill</title></Head>
      {showConfetti && <Confetti width={width} height={height} />}
      <main className="max-w-3xl mx-auto p-6 space-y-8">

        {/* Info Section */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-2xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎮 What Is MadFill?</h2></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>MadFill is an on-chain word game where you create hilarious sentence mashups by filling in blanks on funny templates.</p>
              <p>Each round costs <strong>{ENTRY_FEE} BASE</strong> to create and play. Winner takes the pool!</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Round Setup */}
        <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
          <CardHeader className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Start a New Round</h2>
            <Tooltip text="0.5% fees | Winner claims prize | All on-chain!" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* selectors, inputs, blank chooser */}
            {/* … everything else is exactly as you had it … */}
            <Button
              onClick={handleUnifiedSubmit}
              disabled={!word || busy}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {!roundId ? '🚀 Create & Submit' : '✏️ Submit Entry'}
            </Button>
            {status && <p className="text-sm mt-2">{status}</p>}
            {/* share buttons, recent winners … */}
          </CardContent>
        </Card>
        {/* … rest of your page … */}
      </main>
    </Layout>
  )
}
