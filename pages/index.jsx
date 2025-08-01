// pages/index.jsx
import { useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import { useAccount, useConnect } from 'wagmi'
import abi from '../abi/FillInStoryFull.json'

export default function Home() {
  // 1) Wagmi hooks for connection
  const { address, isConnected } = useAccount()
  const {
    connect,
    connectors,
    error: connectError,
    isLoading: connectLoading,
  } = useConnect()

  // 2) State for "Start Round"
  const [blanks, setBlanks] = useState('3')
  const [startFee, setStartFee] = useState('1000000000000000')  // 0.001 BASE
  const [windowSec, setWindowSec] = useState('300')             // 5 minutes
  const [startStatus, setStartStatus] = useState('')

  // 3) State for "Submit Paid Entry"
  const [paidRoundId, setPaidRoundId] = useState('0')
  const [paidIndex, setPaidIndex] = useState('0')
  const [paidSubmission, setPaidSubmission] = useState('')
  const [paidFee, setPaidFee] = useState('1000000000000000')
  const [paidStatus, setPaidStatus] = useState('')

  // Helper to get a signer
  async function getSigner() {
    // Wagmi’s connectors will have injected or WalletConnect provider
    const provider = new ethers.BrowserProvider(window.ethereum || window.farcaster) 
    return provider.getSigner()
  }

  // 4) Start Round: calls contract.start(...)
  async function startRound() {
    const signer = await getSigner().catch(() => {
      // if no injected, prompt Wagmi connect flow
      connect({ connector: connectors[0] })
      return
    })
    if (!signer) return
    setStartStatus('⏳ Sending start tx…')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await contract.start(
        Number(blanks),
        BigInt(startFee),
        BigInt(windowSec)
      )
      setStartStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setStartStatus('✅ Round started: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setStartStatus('❌ ' + (e.message||e))
    }
  }

  // 5) Submit Paid Entry: calls contract.submitPaid(...)
  async function submitPaidEntry() {
    const signer = await getSigner().catch(() => {
      connect({ connector: connectors[0] })
      return
    })
    if (!signer) return
    setPaidStatus('⏳ Sending entry…')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const data = ethers.formatBytes32String(paidSubmission)
      const tx = await contract.submitPaid(
        BigInt(paidRoundId),
        Number(paidIndex),
        data,
        { value: BigInt(paidFee) }
      )
      setPaidStatus('⏳ Waiting confirmation…')
      await tx.wait()
      setPaidStatus('✅ Entry sent: ' + tx.hash)
    } catch (e) {
      console.error(e)
      setPaidStatus('❌ ' + (e.message||e))
    }
  }

  return (
    <>
      <Head>
        <title>MadFill</title>
      </Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>

        {/* ==== CONNECT UI ==== */}
        {!isConnected ? (
          <>
            {connectors.map((c) => (
              <button
                key={c.id}
                onClick={() => connect({ connector: c })}
                disabled={connectLoading}
                style={{ marginRight: '1rem' }}
              >
                Connect with {c.name}
              </button>
            ))}
            {connectError && <p style={{ color: 'red' }}>{connectError.message}</p>}
          </>
        ) : (
          <p>👛 {address}</p>
        )}

        {/* ==== START ROUND ==== */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>Start Round</h2>
          <label>
            # Blanks:
            <input
              type="number"
              min={1}
              max={10}
              value={blanks}
              onChange={(e) => setBlanks(e.target.value)}
            />
          </label>
          &nbsp;
          <label>
            Entry Fee (wei):
            <input
              type="text"
              value={startFee}
              onChange={(e) => setStartFee(e.target.value)}
            />
          </label>
          &nbsp;
          <label>
            Window (sec):
            <input
              type="text"
              value={windowSec}
              onChange={(e) => setWindowSec(e.target.value)}
            />
          </label>
          <br /><br />
          <button onClick={startRound} disabled={!isConnected}>
            Start Round
          </button>
          {startStatus && <p>{startStatus}</p>}
        </section>

        {/* ==== SUBMIT PAID ENTRY ==== */}
        <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
          <h2>Submit Paid Entry</h2>
          <label>
            Round ID:
            <input
              type="number"
              value={paidRoundId}
              onChange={(e) => setPaidRoundId(e.target.value)}
            />
          </label>
          &nbsp;
          <label>
            Blank Index:
            <input
              type="number"
              min={0}
              value={paidIndex}
              onChange={(e) => setPaidIndex(e.target.value)}
            />
          </label>
          &nbsp;
          <label>
            Your Word:
            <input
              type="text"
              value={paidSubmission}
              onChange={(e) => setPaidSubmission(e.target.value)}
            />
          </label>
          &nbsp;
          <label>
            Fee (wei):
            <input
              type="text"
              value={paidFee}
              onChange={(e) => setPaidFee(e.target.value)}
            />
          </label>
          <br /><br />
          <button onClick={submitPaidEntry} disabled={!isConnected}>
            Submit Paid Entry
          </button>
          {paidStatus && <p>{paidStatus}</p>}
        </section>
      </main>
    </>
  )
}
