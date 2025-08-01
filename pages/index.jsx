// pages/index.jsx
import { useState } from 'react'
import { ethers } from 'ethers'
import abi from '../abi/FillInStoryFull.json'

export default function Home() {
  const [address, setAddress] = useState(null)
  const [signer, setSigner] = useState(null)
  const [status, setStatus] = useState('')
  const [blanks, setBlanks] = useState(3)
  const [fee, setFee] = useState('1000000000000000')    // 0.001 BASE
  const [windowSec, setWindowSec] = useState('300')     // 5 min

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

  async function startRound() {
    if (!signer) return alert('Connect your wallet first')
    setStatus('Sending transaction...')
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )
      const tx = await contract.start(
        Number(blanks),
        BigInt(fee),
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

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Fill-In Story Mini App</h1>

      {!signer ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p>👛 {address}</p>
          <div style={{ margin: '1em 0' }}>
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
                value={fee}
                onChange={(e) => setFee(e.target.value)}
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
          </div>
          <button onClick={startRound}>Start Round</button>
          {status && <p>{status}</p>}
        </>
      )}
    </main>
  )
}
