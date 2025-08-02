// pages/index.jsx
import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers, formatBytes32String } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
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
  const [duration, setDuration] = useState(1)
  const [roundId, setRoundId] = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord] = useState('')
  const [deadline, setDeadline] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()
  const ENTRY_FEE = '0.001'

  const durations = [
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 },
    { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 },
    { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]

  useEffect(() => {
    if (!roundId) return setDeadline(null)
    let cancelled = false
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const info = await contract.rounds(BigInt(roundId))
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
      await instance.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      })
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
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      }
      setStatus('⏳ Submitting entry…')
      const data = formatBytes32String(word)
      const tx2 = await ct.submitPaid(BigInt(newId), Number(blankIndex), data, { value: ethers.parseEther(ENTRY_FEE) })
      await tx2.wait()
      setStatus(`✅ Round ${newId} entry submitted! Tx: ${tx2.hash}`)
    } catch (e) {
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  const truncateAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <>
      <Head><title>MadFill</title></Head>
      <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white">
        <nav className="flex justify-between items-center p-6 shadow-xl bg-slate-950 border-b border-indigo-700">
          <h1 className="text-2xl font-extrabold tracking-tight cursor-pointer hover:text-indigo-300 transition drop-shadow-md" onClick={() => window.location.href = '/'}>
            <span className="animate-pulse">🧠 MadFill</span>
          </h1>
          <div className="space-x-6 text-sm font-medium">
            <a href="/" className="hover:text-indigo-300">Home</a>
            <a href="/active" className="hover:text-indigo-300">Find a Pool</a>
          </div>
        </nav>

        {showConfetti && <Confetti width={width} height={height} />} 

        <main className="max-w-3xl mx-auto p-6 space-y-8">
          <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-2xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎮 What Is MadFill?</h2></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>MadFill is an on-chain word game where you create hilarious sentence mashups by filling in the blanks on funny templates!</p>
              <p>Each new round costs <strong>{ENTRY_FEE} BASE</strong> to create and submit your entry. Your entry goes into the prize pool.</p>
              <p>After a few days, the round ends and a winner is drawn automatically. The winner takes home 99.5% of the pool.</p>
              <p>You can start your own round, or find an active one to enter!</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-2xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">💸 Fee & Pool Breakdown</h2></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>🎯 Paid Entry: <strong>{ENTRY_FEE} BASE</strong></p>
              <p>📦 99.5% to prize pool</p>
              <p>💼 0.5% creator fee (you!)</p>
              <p>🧮 Winners drawn automatically on-chain</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
            <CardContent className="text-center">
              <Button onClick={connectWallet} disabled={!!address || busy} className="bg-indigo-600 hover:bg-indigo-500">
                {address ? `👛 ${truncateAddress(address)}` : 'Connect Wallet'}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-tr from-slate-800 to-purple-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">Start New Round</h2></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))],
                  ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t, i) => ({ label: t.name, value: i }))],
                  ['Duration', duration, setDuration, durations]].map(([label, val, setVal, options]) => (
                  <div key={label}>
                    <label>{label}</label>
                    <select className="block w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1" value={val} onChange={e => setVal(+e.target.value)} disabled={busy}>
                      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part, i) => (
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && (
                      <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                    )}
                  </Fragment>
                ))}
              </div>

              <p className="text-sm">Selected Blank: <strong>{blankIndex}</strong></p>

              <div className="mt-2">
                <label>Your Word</label>
                <input type="text" className="block w-full mt-1 bg-slate-900 text-white border rounded px-2 py-1" value={word} onChange={e => setWord(e.target.value)} disabled={busy} />
              </div>

              {deadline && <p className="text-sm">⏱️ Submissions close in: <Countdown targetTimestamp={deadline} /></p>}

              <Button onClick={handleUnifiedSubmit} disabled={!word || busy} className="bg-indigo-600 hover:bg-indigo-500">
                {!roundId ? '🚀 Create & Submit' : '✏️ Submit Entry'}
              </Button>
              {status && <p className="mt-2 text-sm">{status}</p>}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-indigo-800 text-white shadow-xl rounded-xl">
            <CardHeader><h2 className="text-xl font-bold">🎉 Recent Winners</h2></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {recentWinners.length === 0
                ? <p>No winners yet.</p>
                : recentWinners.map((w, i) => (
                    <p key={i}>Round <strong>#{w.roundId}</strong> → <code>{w.winner}</code></p>
                ))}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  )
}
