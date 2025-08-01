// pages/index.jsx
import { useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner]   = useState(null)
  const [busy, setBusy]       = useState(false)
  const [status, setStatus]   = useState('')

  // ——— Templates ———
  const templates = [
    {
      id: 0,
      name: 'Adventure',
      parts: [
        'Once upon a time, I ',
        ' to the ',
        '.'
      ],
      blanks: 2
    },
    {
      id: 1,
      name: 'Quick Fox',
      parts: [
        'The quick brown ',
        ' jumps over the lazy ',
        '.'
      ],
      blanks: 2
    },
    // …add more templates here…
  ]
  const [templateId, setTemplateId] = useState(templates[0].id)

  // ——— Duration ———
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

  // ——— Fixed Entry Fee ———
  const ENTRY_FEE = '0.001' // in BASE

  // ——— Submission state ———
  const [roundId, setRoundId]       = useState('0')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord]             = useState('')
  const [mode, setMode]             = useState('paid') // 'paid' or 'free'
  const [entryStatus, setEntryStatus] = useState('')

  // ——— Connect Wallet ———
  async function connectWallet() {
    const modal = new Web3Modal({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            rpc: { 8453: 'https://mainnet.base.org' },
            chainId: 8453,
            qrcodeModalOptions: {
              mobileLinks: [
                'metamask',
                'trust',
                'rainbow',
                'argent',
                'imtoken'
              ]
            }
          }
        }
      }
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

  // ——— Start Round ———
  async function startRound() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('⏳ Creating round…')
    try {
      const tpl = templates.find((t) => t.id === Number(templateId))
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await contract.start(
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

  // ——— Submit Entry ———
  async function submitEntry() {
    if (!signer) return connectWallet()
    setBusy(true)
    setEntryStatus('⏳ Sending entry…')
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
      setEntryStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setEntryStatus('✅ Entry submitted! Tx: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setEntryStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // ——— Paper-style template display ———
  const paperStyle = {
    border: '1px solid #ccc',
    background: '#fafafa',
    padding: '1rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    margin: '1rem 0'
  }
  const blankStyle = {
    display: 'inline-block',
    width: '1.5ch',
    textAlign: 'center',
    background: '#fff',
    border: '1px dashed #888',
    margin: '0 0.25ch',
    cursor: 'pointer'
  }

  const tpl = templates.find((t) => t.id === Number(templateId))

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>

        {/* Connect */}
        <button onClick={connectWallet} disabled={!!signer}>
          {signer ? `👛 ${address}` : 'Connect Wallet'}
        </button>

        {/* 1. Start Round */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>1. Choose Template & Start Round</h2>
          <label>
            Template:
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setBlankIndex('0') }}
              disabled={busy}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          &nbsp;
          <label>
            Duration:
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={busy}
            >
              {durations.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
          <p>Entry Fee: <strong>{ENTRY_FEE} BASE</strong></p>
          <button onClick={startRound} disabled={!signer || busy}>
            Create Round
          </button>
          {status && <p>{status}</p>}
        </section>

        {/* 2. Fill in a Blank */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>2. Fill in the Blanks</h2>
          {/* Paper-style template */}
          <div style={paperStyle}>
            {tpl.parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < tpl.blanks && (
                  <span
                    style={{
                      ...blankStyle,
                      borderColor: i === Number(blankIndex) ? '#000' : '#888',
                      background: i === Number(blankIndex) ? '#e0e0e0' : '#fff'
                    }}
                    onClick={() => setBlankIndex(String(i))}
                  >
                    {i}
                  </span>
                )}
              </span>
            ))}
          </div>
          <p>Selected blank: <strong>{blankIndex}</strong></p>

          <label>
            Round ID:
            <input
              type="number"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              disabled={busy}
            />
          </label>
          <br /><br />
          <label>
            Your word:
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              disabled={busy}
            />
          </label>
          <br /><br />
          <label>
            <input
              type="radio"
              name="mode"
              value="paid"
              checked={mode === 'paid'}
              onChange={() => setMode('paid')}
              disabled={busy}
            /> Paid (Fee: {ENTRY_FEE} BASE)
          </label>
          &nbsp;
          <label>
            <input
              type="radio"
              name="mode"
              value="free"
              checked={mode === 'free'}
              onChange={() => setMode('free')}
              disabled={busy}
            /> Free
          </label>
          <br /><br />
          <button onClick={submitEntry} disabled={!signer || busy}>
            {mode === 'paid' ? 'Submit Paid Entry' : 'Submit Free Entry'}
          </button>
          {entryStatus && <p>{entryStatus}</p>}
        </section>
      </main>
    </>
  )
}
