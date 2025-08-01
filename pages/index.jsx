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

  // ----- Round Setup -----
  const [blanks, setBlanks]       = useState('3')
  const [fee, setFee]             = useState('0.001')   // BASE
  const [windowMin, setWindowMin] = useState('5')       // minutes
  const [startStatus, setStartStatus] = useState('')

  // ----- Entry Submission -----
  const [roundId, setRoundId]       = useState('0')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord]             = useState('')
  const [mode, setMode]             = useState('paid')  // 'paid' or 'free'
  const [entryStatus, setEntryStatus] = useState('')

  // A placeholder story template – replace with real one later:
  const storyTemplate = 'Once upon a time, I __X__ to the __Y__.' 
  // where X and Y are blanks 0 and 1

  // Connect (injected or WalletConnect)
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
              mobileLinks: ['metamask','trust','rainbow','argent','imtoken']
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

  // Start a new round
  async function startRound() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStartStatus('⏳ Creating round…')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await contract.start(
        Number(blanks),
        ethers.parseEther(fee),
        BigInt(Number(windowMin) * 60)
      )
      setStartStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setStartStatus('✅ Round created! Tx: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setStartStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // Submit an entry (paid or free)
  async function submitEntry() {
    if (!signer) return connectWallet()
    setBusy(true)
    setEntryStatus('⏳ Sending your entry…')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      let tx
      const data = ethers.formatBytes32String(word)
      if (mode === 'paid') {
        tx = await contract.submitPaid(
          BigInt(roundId),
          Number(blankIndex),
          data,
          { value: ethers.parseEther(fee) }
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
      setEntryStatus(`✅ ${mode === 'paid' ? 'Paid' : 'Free'} entry sent! Tx: ${tx.hash}`)
    } catch (e) {
      console.error(e)
      setEntryStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>

        {/* CONNECT WALLET */}
        <button onClick={connectWallet} disabled={!!signer} style={{ marginBottom: '1rem' }}>
          {signer ? `👛 ${address}` : 'Connect Wallet'}
        </button>

        {/* SECTION 1: Start Round */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>1. Start a New Round</h2>
          <p><em>Tell MadFill how many blanks, the entry fee, and how long submissions run.</em></p>
          <label>
            Blanks (1–10):
            <input
              type="number" min={1} max={10}
              value={blanks}
              onChange={(e) => setBlanks(e.target.value)}
              disabled={busy}
            />
          </label>
          &nbsp;
          <label>
            Entry Fee (BASE):
            <input
              type="text"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              disabled={busy}
            />
          </label>
          &nbsp;
          <label>
            Window (minutes):
            <input
              type="text"
              value={windowMin}
              onChange={(e) => setWindowMin(e.target.value)}
              disabled={busy}
            />
          </label>
          <br /><br />
          <button onClick={startRound} disabled={!signer || busy}>
            Create Round
          </button>
          {startStatus && <p>{startStatus}</p>}
        </section>

        {/* SECTION 2: Submit Entry */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>2. Fill in the Blanks</h2>
          <p><strong>Story:</strong> {storyTemplate}</p>
          <label>
            Round ID:
            <input
              type="number"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              disabled={busy}
            />
          </label>
          &nbsp;
          <label>
            Blank # (0–{Number(blanks) - 1}):
            <input
              type="number"
              min={0}
              max={Number(blanks) - 1}
              value={blankIndex}
              onChange={(e) => setBlankIndex(e.target.value)}
              disabled={busy}
            />
          </label>
          &nbsp;
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
            /> Paid (Fee: {fee} BASE)
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
