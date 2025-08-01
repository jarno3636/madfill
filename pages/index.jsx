// pages/index.jsx
import { useState, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner]   = useState(null)
  const [busy, setBusy]       = useState(false)
  const [status, setStatus]   = useState('')

  const categories = [
    {
      name: 'Cryptocurrency',
      templates: [
        {
          id: 'crypto1',
          name: 'Crypto Chaos',
          blanks: 5,
          parts: [
            'When Bitcoin soared to ',
            ', the community yelled ',
            '; later it dipped to ',
            ', yet traders still ',
            ', and then ',
            '.',
          ],
        },
      ],
    },
    {
      name: 'Funny',
      templates: [
        {
          id: 'funny1',
          name: 'Office Antics',
          blanks: 5,
          parts: [
            'During meetings, I always ',
            ' the notes, ',
            ' snacks for my team, ',
            ' coffee, ',
            ' and still ',
            '.',
          ],
        },
      ],
    },
  ]
  const [catIdx, setCatIdx]       = useState(0)
  const [tplIdx, setTplIdx]       = useState(0)
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
  const [duration, setDuration] = useState(durations[0].value)

  const ENTRY_FEE = '0.001'

  const [roundId, setRoundId]       = useState('0')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord]             = useState('')
  const [mode, setMode]             = useState('paid')

  async function connectWallet() {
    try {
      const modal = new Web3Modal({
        cacheProvider: false,
        providerOptions: {
          walletconnect: {
            package: WalletConnectProvider,
            options: {
              rpc: { 8453: 'https://mainnet.base.org' },
              chainId: 8453,
              qrcodeModalOptions: {
                mobileLinks: ['metamask','trust','rainbow','argent','imtoken'],
              },
            },
          },
        },
      })
      const instance = await modal.connect()
      const provider = new ethers.BrowserProvider(instance)
      const _signer  = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (e) {
      console.error(e)
      alert('Wallet connection failed: ' + (e.message || e))
    }
  }

  async function startRound() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('⏳ Creating round…')
    try {
      const tx = await new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      ).start(
        tpl.blanks,
        ethers.parseEther(ENTRY_FEE),
        BigInt(duration * 24 * 60 * 60)
      )
      setStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setStatus('✅ Round created! Tx: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function submitEntry() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('⏳ Submitting your entry…')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const data = ethers.formatBytes32String(word)
      let tx
      if (mode === 'paid') {
        tx = await contract.submitPaid(
          BigInt(roundId),
          Number(blankIndex),
          data,
          { value: ethers.parseEther(ENTRY_FEE) }
        )
      } else {
        tx = await contract.submitFree(
          BigInt(roundId),
          Number(blankIndex),
          data
        )
      }
      setStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setStatus('✅ Entry submitted! Tx: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const paperStyle = 'bg-gray-50 border border-gray-200 p-4 font-mono whitespace-pre-wrap'
  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${
      active ? 'border-black' : 'border-gray-400'
    } cursor-pointer mx-1`

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-4xl font-extrabold text-center">MadFill</h1>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <h2 className="text-2xl">How It Works</h2>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              <li>Connect your wallet.</li>
              <li>Pick a category, template & duration, then ▶️ Create Round.</li>
              <li>Click a blank below, type your word, choose Paid or Free, Submit.</li>
              <li>Entries go on-chain; winners are drawn automatically.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Connect */}
        <Card>
          <CardContent className="text-center">
            <Button onClick={connectWallet} disabled={!!address || busy}>
              {address ? `👛 ${address}` : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>

        {/* Create Round */}
        <Card>
          <CardHeader>
            <h2 className="text-2xl">1. Create a New Round</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block">Category</label>
                <select
                  className="mt-1 border rounded px-2 py-1"
                  value={catIdx}
                  onChange={(e) => {
                    setCatIdx(Number(e.target.value))
                    setTplIdx(0)
                  }}
                  disabled={busy}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={i}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block">Template</label>
                <select
                  className="mt-1 border rounded px-2 py-1"
                  value={tplIdx}
                  onChange={(e) => setTplIdx(Number(e.target.value))}
                  disabled={busy}
                >
                  {selectedCategory.templates.map((t, i) => (
                    <option key={t.id} value={i}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block">Duration</label>
                <select
                  className="mt-1 border rounded px-2 py-1"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={busy}
                >
                  {durations.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p>Entry Fee: <strong>{ENTRY_FEE} BASE</strong></p>
            <Button onClick={startRound} disabled={!address || busy}>
              ▶️ Create Round
            </Button>
            {status && <p className="mt-2">{status}</p>}
          </CardContent>
        </Card>

        {/* Fill in the Blanks */}
        <Card>
          <CardHeader>
            <h2 className="text-2xl">2. Fill in the Blanks</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={paperStyle}>
              {tpl.parts.map((part, i) => (
                <Fragment key={i}>
                  <span>{part}</span>
                  {i < tpl.blanks && (
                    <span
                      className={blankStyle(i === Number(blankIndex))}
                      onClick={() => setBlankIndex(String(i))}
                    >
                      {i}
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
            <p>Selected Blank: <strong>{blankIndex}</strong></p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block">Round ID</label>
                <input
                  type="number"
                  className="mt-1 border rounded px-2 py-1"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="block">Your Word</label>
                <input
                  type="text"
                  className="mt-1 border rounded px-2 py-1"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  value="paid"
                  checked={mode === 'paid'}
                  onChange={() => setMode('paid')}
                  disabled={busy}
                />
                <span>Paid ({ENTRY_FEE} BASE)</span>
              </label>
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  value="free"
                  checked={mode === 'free'}
                  onChange={() => setMode('free')}
                  disabled={busy}
                />
                <span>Free</span>
              </label>
            </div>
            <Button onClick={submitEntry} disabled={!address || busy}>
              {mode === 'paid' ? 'Submit Paid Entry' : 'Submit Free Entry'}
            </Button>
            {status && <p className="mt-2">{status}</p>}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
