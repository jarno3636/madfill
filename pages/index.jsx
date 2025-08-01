// pages/index.jsx
import { useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '../abi/FillInStoryFull.json'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner] = useState(null)
  const [status, setStatus] = useState('')
  const [blanks, setBlanks] = useState('3')
  const [startFee, setStartFee] = useState('1000000000000000')    // 0.001 BASE
  const [windowSec, setWindowSec] = useState('300')               // 5 min

  // Paid-entry states:
  const [paidRoundId, setPaidRoundId] = useState('0')
  const [paidIndex, setPaidIndex] = useState('0')
  const [paidSubmission, setPaidSubmission] = useState('')
  const [paidFee, setPaidFee] = useState('1000000000000000')
  const [paidStatus, setPaidStatus] = useState('')

  // Connect wallet
  async function connectWallet() {
    if (!window.ethereum) {
      alert('Install a Web3 wallet (e.g. MetaMask)')
      return
    }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const _signer = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (err) {
      console.error(err)
      alert('Failed to connect')
    }
  }

  // start(...)
  async function startRound() {
    if (!signer) return alert('Connect your wallet first')
    setStatus('Sending start transaction...')
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
      setStatus('Waiting for confirmation...')
      await tx.wait()
      setStatus('✅ Round started! Tx: ' + tx.hash)
    } catch (err) {
      console.error(err)
      setStatus('❌ Error: ' + (err.message || err))
    }
  }

  // submitPaid(...)
  async function submitPaidEntry() {
    if (!signer) return alert('Connect your wallet first')
    setPaidStatus('Sending paid entry...')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      // convert your word to bytes32
      const data = ethers.formatBytes32String(paidSubmission)
      const tx = await contract.submitPaid(
        BigInt(paidRoundId),
        Number(paidIndex),
        data,
        { value: BigInt(paidFee) }
      )
      setPaidStatus('Waiting for confirmation...')
      await tx.wait()
      setPaidStatus('✅ Entry submitted! Tx: ' + tx.hash)
    } catch (err) {
      console.error(err)
      setPaidStatus('❌ Error: ' + (err.message || err))
    }
  }

  return (
    <>
      <Head>
        <title>MadFill</title>
      </Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>

        {!signer ? (
          <button onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <>
            <p>👛 {address}</p>

            {/* START ROUND */}
            <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ddd' }}>
              <h2>Start Round</h2>
              <label>
                # Blanks:
                <input
                  type="number"
                  value={blanks}
                  min={1}
                  max={10}
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
              <button onClick={startRound}>Start Round</button>
              {status && <p>{status}</p>}
            </section>

            {/* SUBMIT PAID ENTRY */}
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
                  value={paidIndex}
                  onChange={(e) => setPaidIndex(e.target.value)}
                  min={0}
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
              <button onClick={submitPaidEntry}>Submit Paid Entry</button>
              {paidStatus && <p>{paidStatus}</p>}
            </section>
          </>
        )}
      </main>
    </>
  )
}
