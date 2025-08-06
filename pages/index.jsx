// pages/index.jsx
import React, { useState, useEffect, Fragment, useRef } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV2_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import { Tooltip } from '@/components/ui/tooltip'
import Footer from '@/components/Footer'
import { fetchFarcasterProfile } from '@/lib/neynar'

export default function Home() {
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [roundName, setRoundName] = useState('')
  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [feeUsd, setFeeUsd] = useState(1.0)
  const [shareText, setShareText] = useState('')
  const [busy, setBusy] = useState(false)
  const { width, height } = useWindowSize()
  const [totalRounds, setTotalRounds] = useState(null)
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [profile, setProfile] = useState(null)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const log = (msg) => {
    setLogs(prev => [...prev, msg])
    setTimeout(() => {
      if (loggerRef.current) {
        loggerRef.current.scrollTop = loggerRef.current.scrollHeight
      }
    }, 100)
  }

  useEffect(() => {
    async function loadProfile() {
      const fid = localStorage.getItem('fc_fid')
      if (fid) {
        const p = await fetchFarcasterProfile(fid)
        setProfile(p)
      }
    }
    loadProfile()

    async function loadTotalRounds() {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
      const count = await ct.pool1Count()
      setTotalRounds(Number(count))
    }
    loadTotalRounds()
  }, [])

  async function handleUnifiedSubmit() {
    const cleanedParts = tpl.parts.map(p => p.trim())

    if (!word || word.length > 32) {
      setStatus('❌ Word must be 1–32 characters long.')
      log('Invalid word input')
      return
    }

    if (feeUsd < 0.25) {
      setStatus('❌ Entry fee must be at least $0.25')
      log('Fee too low')
      return
    }

    if (cleanedParts.length !== tpl.blanks + 1) {
      setStatus('❌ Template error: Number of parts must equal blanks + 1')
      log('Template mismatch')
      return
    }

    try {
      setBusy(true)
      setStatus('')
      log('🔍 Connecting to wallet…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)

      const usdMicro = ethers.parseUnits(feeUsd.toString(), 6) // 1.0 -> 1000000
      const baseWithoutFee = await ct.usdToBase(usdMicro)
      const feeBuffer = baseWithoutFee * 1005n / 1000n // add 0.5%

      let newId = roundId

      if (!roundId) {
        log(`🚀 Creating round "${roundName || 'Untitled'}"…`)
        const tx = await ct.createPool1(
          roundName || 'Untitled',
          cleanedParts,
          word,
          profile?.username || 'anon',
          usdMicro,
          duration * 86400,
          { value: feeBuffer }
        )
        log('📡 Waiting for tx confirmation…')
        const receipt = await tx.wait()
        const creationEvent = receipt.logs.find(log => log.fragment?.name === 'Pool1Created')
        if (creationEvent) {
          newId = creationEvent.args.id.toString()
          setRoundId(newId)
          localStorage.setItem(`madfill-roundname-${newId}`, roundName)
          log(`✅ Round ${newId} created.`)
        }
      } else {
        log(`✍️ Joining Round #${roundId}…`)
        const tx = await ct.joinPool1(
          roundId,
          word,
          profile?.username || 'anon',
          { value: feeBuffer }
        )
        await tx.wait()
        log(`✅ Joined Round ${roundId}`)
      }

      const preview = cleanedParts.map((p, i) => i < tpl.blanks ? `${p}${i === +blankIndex ? word : '____'}` : p).join('')
      setShareText(encodeURIComponent(`I just entered MadFill Round #${newId} 💥\n\n${preview}\n\nPlay: https://madfill.vercel.app`))
      setStatus(`✅ Submitted to Round ${newId}`)
    } catch (err) {
      console.error(err)
      setStatus(`❌ ${err?.message?.split('(')[0] || 'Failed'}`)
      log(`❌ ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-16 text-center border-b-2 font-bold text-lg ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  const renderTemplatePreview = () => (
    <p className="text-base bg-slate-700 p-4 rounded-xl leading-relaxed shadow-md border border-indigo-400">
      📄 {tpl.parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < tpl.blanks && (
            <span
              className={blankStyle(i === +blankIndex)}
              onClick={() => setBlankIndex(i.toString())}
            >
              {i === +blankIndex ? (word || '____') : '____'}
            </span>
          )}
        </Fragment>
      ))}
    </p>
  )

  return (
    <Layout>
      <Head><title>MadFill</title></Head>
      {shareText && <Confetti width={width} height={height} />}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Intro card and rest of UI stays unchanged */}
        <Footer />
      </main>
    </Layout>
  )
}
