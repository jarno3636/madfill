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

  // ——— Categories & Templates ———
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
        {
          id: 'crypto2',
          name: 'To the Moon',
          blanks: 5,
          parts: [
            'Every time ',
            ' tweets about ',
            ', price rockets to ',
            '! Meanwhile ',
            ' investors ',
            '.',
          ],
        },
        {
          id: 'crypto3',
          name: 'HODL Story',
          blanks: 5,
          parts: [
            'I bought ',
            ' at ',
            ' and promised to ',
            ' forever if it reached ',
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
        {
          id: 'funny2',
          name: 'Cat Chronicles',
          blanks: 5,
          parts: [
            'My cat ',
            ' ate the ',
            ' when I was ',
            ', then ',
            ' and ',
            '.',
          ],
        },
        {
          id: 'funny3',
          name: 'Lottery Dreams',
          blanks: 5,
          parts: [
            'If I won the lottery, I would ',
            ' a ',
            ', give ',
            ' to my ',
            ' and ',
            '.',
          ],
        },
      ],
    },
    {
      name: 'Pop Culture',
      templates: [
        {
          id: 'pop1',
          name: 'May the Force',
          blanks: 2,
          parts: ['May the ', ' be with ', '.'],
        },
        {
          id: 'pop2',
          name: 'Movie Tagline',
          blanks: 3,
          parts: [
            'In a world where ',
            ', one ',
            ' must ',
            ' to save ',
            '.',
          ],
        },
        {
          id: 'pop3',
          name: 'Music Lyrics',
          blanks: 4,
          parts: [
            'I got ',
            ' on my ',
            ', feeling ',
            ' like a ',
            ' tonight.',
          ],
        },
      ],
    },
    {
      name: 'Animals',
      templates: [
        {
          id: 'animal1',
          name: 'Jungle Chase',
          blanks: 3,
          parts: [
            'The ',
            ' chased the ',
            ' over the ',
            '.',
          ],
        },
        {
          id: 'animal2',
          name: 'Pet Routine',
          blanks: 3,
          parts: [
            'Every morning, my ',
            ' likes to ',
            ' before ',
            '.',
          ],
        },
      ],
    },
    {
      name: 'Food',
      templates: [
        {
          id: 'food1',
          name: 'Cooking Show',
          blanks: 4,
          parts: [
            'First, chop the ',
            ' and sauté with ',
            '; then add ',
            ' and simmer until ',
            '.',
          ],
        },
        {
          id: 'food2',
          name: 'Pizza Order',
          blanks: 4,
          parts: [
            'I always get ',
            ' pizza with extra ',
            ', a side of ',
            ', and a drink of ',
            '.',
          ],
        },
      ],
    },
  ]

  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  // ——— Duration (days) ———
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

  // ——— Submission state ———
  const ENTRY_FEE = '0.001' // in BASE
  const [roundId, setRoundId]       = useState('0')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord]             = useState('')
  const [mode, setMode]             = useState('paid')

  // —— Connect Wallet ——
  async function connectWallet() {
    const modal = new Web3Modal({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            rpc: { 8453: 'https://mainnet.base.org' },
            chainId: 8453,
            qrcodeModalOptions: { mobileLinks: ['metamask','trust','rainbow','argent','imtoken'] },
          },
        },
      },
    })
    try {
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

  // —— Start Round ——
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
      setStatus('✅ Round created! ID=' + ( (await ethers.getDefaultProvider()).getBlockNumber() /* placeholder: read index on chain */ ))
    } catch (e) {
      console.error(e)
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // —— Submit Entry ——
  async function submitEntry() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('⏳ Submitting entry…')
    try {
      const ct = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const data = ethers.formatBytes32String(word)
      let tx
      if (mode === 'paid') {
        tx = await ct.submitPaid(BigInt(roundId), Number(blankIndex), data, { value: ethers.parseEther(ENTRY_FEE) })
      } else {
        tx = await ct.submitFree(BigInt(roundId), Number(blankIndex), data)
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

  // —— Styles ——
  const paperStyle = 'bg-gray-50 border border-gray-200 p-4 font-mono whitespace-pre-wrap my-4'
  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-black' : 'border-gray-400'} cursor-pointer mx-1`

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-4xl font-extrabold text-center">MadFill</h1>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <h2>How It Works</h2>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-1">
              <li>Connect your wallet.</li>
              <li>Pick category, template & duration → Create Round → note your Round ID.</li>
              <li>Click a blank above, type your word, choose Paid/Free, enter Round ID and Submit.</li>
              <li>Winners are drawn on-chain—good luck!</li>
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

        {/* Create Round */}
        <Card>
          <CardHeader><h2>1. Create a New Round</h2></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label>Category</label>
                <select
                  className="block mt-1 border rounded px-2 py-1"
                  value={catIdx}
                  onChange={(e) => { setCatIdx(Number(e.target.value)); setTplIdx(0) }}
                  disabled={busy}
                >
                  {categories.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Template</label>
                <select
                  className="block mt-1 border rounded px-2 py-1"
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
                <label>Duration</label>
                <select
                  className="block mt-1 border rounded px-2 py-1"
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
          <CardHeader><h2>2. Fill in the Blanks</h2></CardHeader>
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
                <label>Round ID</label>
                <input
                  type="number"
                  className="block mt-1 border rounded px-2 py-1"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex-1">
                <label>Your Word</label>
                <input
                  type="text"
                  className="block w-full mt-1 border rounded px-2 py-1"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="paid"
                  checked={mode === 'paid'}
                  onChange={() => setMode('paid')}
                  disabled={busy}
                />
                <span>Paid ({ENTRY_FEE} BASE)</span>
              </label>
              <label className="flex items-center space-x-2">
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
