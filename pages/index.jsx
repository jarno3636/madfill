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

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    contract.rounds(BigInt(roundId)).then(info => {
      setDeadline(info.sd.toNumber())
    }).catch(() => setDeadline(null))
  }, [roundId])

  useEffect(() => {
    const loadWinners = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
        const last5 = events.slice(-5).reverse().map(e => ({
          roundId: e.args.id.toNumber(),
          winner: e.args.winner,
        }))
        setRecentWinners(last5)
      } catch (err) {
        console.error('Failed to load winners', err)
      }
    }
    loadWinners()
  }, [])

  async function handleUnifiedSubmit() {
    try {
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      setBusy(true)
      setStatus('')
      let newId = roundId

      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx = await ct.start(
          tpl.blanks,
          ethers.parseEther(ENTRY_FEE),
          BigInt(duration * 86400)
        )
        await tx.wait()
        const events = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = events[events.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
        localStorage.setItem(`madfill-roundname-${newId}`, roundName || '')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      }

      setStatus('⏳ Submitting entry…')
      const data = ethers.encodeBytes32String(word)
      const tx2 = await ct.submitPaid(BigInt(newId), Number(blankIndex), data, {
        value: ethers.parseEther(ENTRY_FEE),
      })
      await tx2.wait()
      setStatus(`✅ Round ${newId} entry submitted!`)

      const preview = tpl.parts.map((part, i) =>
        i < tpl.blanks ? `${part}${i === Number(blankIndex) ? word : '____'}` : part
      ).join('')
      const share = encodeURIComponent(`I just entered a hilarious on-chain word game! 🧠\n\n${preview}\n\nPlay here: https://madfill.vercel.app`)
      setShareText(share)
    } catch (e) {
      console.error(e)
      if (e?.message?.toLowerCase().includes('denied')) {
        setStatus('❌ Transaction cancelled.')
      } else if (e?.reason || e?.message) {
        const reason = e.reason || e.message
        setStatus(`❌ ${reason.split('\n')[0]}`)
      } else {
        setStatus('❌ An unexpected error occurred.')
      }
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
        {/* ... content unchanged ... */}
      </main>
    </Layout>
  )
}
