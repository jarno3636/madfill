// pages/index.jsx
import { useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner] = useState(null)
  const [status, setStatus] = useState('')

  // Start‐round state
  const [blanks, setBlanks] = useState('3')
  const [startFee, setStartFee] = useState('1000000000000000')
  const [windowSec, setWindowSec] = useState('300')

  // Paid‐entry state
  const [paidRoundId, setPaidRoundId] = useState('0')
  const [paidIndex, setPaidIndex] = useState('0')
  const [paidSubmission, setPaidSubmission] = useState('')
  const [paidFee, setPaidFee] = useState('1000000000000000')
  const [paidStatus, setPaidStatus] = useState('')

  // Unified connect: injected → Web3Modal
  async function connectWallet() {
    try {
      // Web3Modal config
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

      // If injected, modal.connect() will pick window.ethereum automatically
      const instance = await modal.connect()
      const provider = new ethers.BrowserProvider(instance)
      const _signer = await provider.getSigner()
      const _address = await _signer.getAddress()

      setSigner(_signer)
      setAddress(_address)
    } catch (err) {
      console.error(err)
      alert('Wallet connection failed: ' + (err.message || err))
    }
  }

  // start(...)
  async function startRound() {
    if (!signer) return connectWallet()
    setStatus('⏳ Sending start transaction...')
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
      setStatus('⏳ Waiting for confirmation...')
      await tx.wait()
      setStatus('✅ Round started! Tx: ' + tx.hash)
    } catch (err) {
      console.error(err)
      setStatus('❌ Error: ' + (err.message || err))
    }
  }

  // submitPaid(...)
  async function submitPaidEntry() {
    if (!signer) return connectWallet()
    setPaidStatus('⏳ Sending paid entry...')
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
      setPaidStatus('⏳ Waiting for confirmation...')
      await tx.wait()
      setPaidStatus('✅ Entry submitted! Tx: ' + tx.hash)
    } catch (err) {
      console.error(err)
      setPaidStatus('❌ Error: ' + (err.message || err))
    }
  }

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>

        {/* CONNECT WALLET */}
        <button onClick={connectWallet} style={{ marginBottom: '1rem' }}>
          {signer ? `👛 ${address}` : 'Connect Wallet'}
        </button>

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
      </main>
    </>
  )
}
