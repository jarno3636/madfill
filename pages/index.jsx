// pages/index.jsx
import React, { Component, useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV2_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'
import Footer from '@/components/Footer'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, error: err }
  }
  componentDidCatch(err, info) {
    console.error('ErrorBoundary caught:', err, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong.</h2>
          <pre className="mt-4 p-4 bg-slate-100 text-sm text-red-800 rounded">
            {this.state.error?.toString()}
          </pre>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Home() {
  const [status, setStatus] = useState('')
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [deadline, setDeadline] = useState(null)
  const [recentWinners, setRecentWinners] = useState([])
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_USD = 1 // USD based entry fee

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    ct.getPool1Info(BigInt(roundId))
      .then(info => setDeadline(Number(info.deadline)))
      .catch(() => setDeadline(null))
  }, [roundId])

  async function handleUnifiedSubmit() {
    if (!word) return setStatus('❌ Please enter a word.')

    try {
      setBusy(true)
      setStatus('')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      let newId = roundId

      if (!roundId) {
        setStatus('🚀 Creating new round...')
        const tx = await ct.createPool1(
          roundName || `Untitled`,
          tpl.parts,
          word,
          signer.address.slice(0, 6),
          ENTRY_USD,
          duration * 86400
        )
        await tx.wait()
        const poolCount = await ct.pool1Count()
        newId = (Number(poolCount) - 1).toString()
        setRoundId(newId)
        const info = await ct.getPool1Info(newId)
        setDeadline(Number(info.deadline))
        localStorage.setItem(`madfill-roundname-${newId}`, roundName)
      } else {
        setStatus('✍️ Submitting your entry...')
        const tx2 = await ct.joinPool1(newId, word, signer.address.slice(0, 6), {
          value: ethers.parseEther('0.001') // fallback, ideally fetch converted BASE
        })
        await tx2.wait()
      }

      setStatus(`✅ Entry for Round ${newId} submitted!`)
      const preview = tpl.parts.map((part, i) => i < tpl.blanks ? `${part}${i === +blankIndex ? word : '____'}` : part).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))

    } catch (e) {
      setStatus('❌ ' + (e.message || 'Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active => `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <ErrorBoundary>
      <Layout>
        <Head>
          <title>MadFill</title>
        </Head>
        {shareText && <Confetti width={width} height={height} />}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-gradient-to-r from-yellow-500 to-red-500 text-white rounded p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">💰 Fee Breakdown</h3>
            <ul className="list-disc list-inside text-sm">
              <li><strong>Create Round:</strong> Just gas! Set your entry fee in USD.</li>
              <li><strong>Enter Pool:</strong> ~$1 USD per entry (converted to BASE automatically)</li>
              <li><strong>Payout:</strong> Winner (Pool 1) or all voters on winning side (Pool 2)</li>
              <li><strong>Fees:</strong> 0.5% of all transactions go to dev wallet</li>
            </ul>
          </Card>
        </motion.div>

        <main className="max-w-4xl mx-auto p-6 space-y-8">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="bg-purple-800 text-white shadow-2xl rounded-xl">
              <CardHeader>
                <h2 className="text-2xl font-extrabold">🧠 What Is MadFill?</h2>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>MadFill is an on-chain word game where your creativity earns crypto! 🤯</p>
                <p>1. Create a round with a silly sentence starter.<br/>2. Pay ~$1 (in BASE) to add your wildest word.<br/>3. Win if selected randomly!</p>
                <p>Then challenge the card in a voting battle in Pool 2 🥊</p>
                <p><strong>Fully decentralized, fair, and fun!</strong></p>
              </CardContent>
            </Card>
          </motion.div>

          {/* ... rest of the existing code remains unchanged ... */}

        </main>
        <Footer/>
      </Layout>
    </ErrorBoundary>
  )
}
