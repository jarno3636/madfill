// pages/index.jsx
import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers, formatBytes32String } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import { categories } from '../data/templates'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [recentWinners, setRecentWinners] = useState([])

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  const durations = [
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 },
    { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 },
    { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]
  const [duration, setDuration] = useState(1)
  const ENTRY_FEE = '0.001'
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord] = useState('')
  const [mode, setMode] = useState('paid')
  const [deadline, setDeadline] = useState(null)

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    let cancelled = false
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const rpcContract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const info = await rpcContract.rounds(BigInt(roundId))
        if (!cancelled) setDeadline(info.sd.toNumber())
      } catch {
        if (!cancelled) setDeadline(null)
      }
    })()
    return () => { cancelled = true }
  }, [roundId])

  useEffect(() => {
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
        const last5 = events.slice(-5).reverse().map(e => ({
          roundId: e.args.id.toNumber(),
          winner: e.args.winner,
        }))
        setRecentWinners(last5)
      } catch (e) {
        console.error('Failed to load recent winners', e)
      }
    })()
  }, [])

  async function connectWallet() {
    const modal = new Web3Modal({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: { rpc: { 8453: 'https://mainnet.base.org' }, chainId: 8453 },
        },
      },
    })
    try {
      const instance = await modal.connect()
      const provider = new ethers.BrowserProvider(instance)
      const _signer = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (e) {
      alert('Wallet connection failed: ' + (e.message || e))
    }
  }

  async function handleUnifiedSubmit() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('')
    let newId = roundId
    try {
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx1 = await ct.start(tpl.blanks, ethers.parseEther(ENTRY_FEE), BigInt(duration * 86400))
        await tx1.wait()
        const evs = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = evs[evs.length - 1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
      }
      setStatus('⏳ Submitting entry…')
      const data = formatBytes32String(word)
      const tx2 = mode === 'paid'
        ? await ct.submitPaid(BigInt(newId), Number(blankIndex), data, { value: ethers.parseEther(ENTRY_FEE) })
        : await ct.submitFree(BigInt(newId), Number(blankIndex), data)
      await tx2.wait()
      setStatus(`✅ Round ${newId} ${mode} entry submitted! Tx: ${tx2.hash}`)
    } catch (e) {
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const paperStyle = 'bg-gray-50 border border-gray-200 p-4 font-mono whitespace-pre-wrap my-4'
  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-black' : 'border-gray-400'} cursor-pointer mx-1`

  const navigate = (path) => (window.location.href = path)

  return (
    <>
      <Head><title>MadFill</title></Head>
      <nav className="flex justify-between items-center p-4 bg-gray-100">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>MadFill</h1>
        <div className="space-x-4">
          <a href="/" className="text-blue-600">Home</a>
          <a href="/active" className="text-blue-600">Active Rounds</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {/* How It Works */}
        <Card>
          <CardHeader><h2>How It Works</h2></CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              <li>Connect your wallet.</li>
              <li>Select category, template & duration, type your word.</li>
              <li>Click “{!roundId ? 'Create & Submit' : mode === 'paid' ? 'Submit Paid' : 'Submit Free (gas only)'}” — free entries still incur an on-chain gas fee.</li>
              <li>Round is created then your entry is submitted.</li>
              <li>Winners are drawn on-chain — browse Active Rounds for more.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Connect Wallet */}
        <Card>
          <CardContent className="text-center">
            <Button onClick={connectWallet} disabled={!!address || busy}>
              {address ? `👛 ${address}` : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>

        {/* Unified Entry Card */}
        <Card>
          <CardHeader><h2>New Round & Submit Entry</h2></CardHeader>
          <CardContent className="space-y-4">
            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label>Category</label>
                <select className="block w-full mt-1 border rounded px-2 py-1" value={catIdx} onChange={e => { setCatIdx(+e.target.value); setTplIdx(0) }} disabled={busy}>
                  {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Template</label>
                <select className="block w-full mt-1 border rounded px-2 py-1" value={tplIdx} onChange={e => setTplIdx(+e.target.value)} disabled={busy}>
                  {selectedCategory.templates.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label>Duration</label>
                <select className="block w-full mt-1 border rounded px-2 py-1" value={duration} onChange={e => setDuration(+e.target.value)} disabled={busy}>
                  {durations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* Story Blanks */}
            <div className={paperStyle}>
              {tpl.parts.map((part, i) => (
                <Fragment key={i}>
                  <span>{part}</span>
                  {i < tpl.blanks && (
                    <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                  )}
                </Fragment>
              ))}
            </div>

            <p>Selected Blank: <strong>{blankIndex}</strong></p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label>Your Word</label>
                <input type="text" className="block w-full mt-1 border rounded px-2 py-1" value={word} onChange={e => setWord(e.target.value)} disabled={busy} />
              </div>
              <div className="flex items-center space-x-4 mt-6">
                <label className="flex items-center space-x-2">
                  <input type="radio" value="paid" checked={mode === 'paid'} onChange={() => setMode('paid')} disabled={busy} />
                  <span>Paid ({ENTRY_FEE} BASE)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" value="free" checked={mode === 'free'} onChange={() => setMode('free')} disabled={busy} />
                  <span>Free (gas only)</span>
                </label>
              </div>
            </div>

            {deadline && <p className="text-sm">⏱️ Submissions close in: <Countdown targetTimestamp={deadline} /></p>}

            <Button onClick={handleUnifiedSubmit} disabled={!word || busy}>
              {!roundId ? '🚀 Create & Submit' : (mode === 'paid' ? '💸 Submit Paid' : '✏️ Submit Free')}
            </Button>
            {status && <p className="mt-2">{status}</p>}
          </CardContent>
        </Card>

        {/* Recent Winners */}
        <Card>
          <CardHeader><h2>🎉 Recent Winners</h2></CardHeader>
          <CardContent className="space-y-1">
            {recentWinners.length === 0
              ? <p>No winners yet.</p>
              : recentWinners.map((w, i) => (
                  <p key={i}>
                    Round <strong>#{w.roundId}</strong> → <code>{w.winner}</code>
                  </p>
                ))}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
