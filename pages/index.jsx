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
  // … other state …

  // ------- CONNECT WALLET (injected or WalletConnect) -------
  async function connectWallet() {
    try {
      let provider
      if (window.ethereum) {
        // injected (MetaMask, Coinbase Wallet in-app)
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        provider = new ethers.BrowserProvider(window.ethereum)
      } else {
        // fallback to WalletConnect
        const modal = new Web3Modal({
          cacheProvider: true,
          providerOptions: {
            walletconnect: {
              package: WalletConnectProvider,
              options: {
                rpc: { 8453: 'https://mainnet.base.org' },
                chainId: 8453
              }
            }
          }
        })
        const wcProvider = await modal.connect()
        provider = new ethers.BrowserProvider(wcProvider)
      }
      const _signer = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (err) {
      console.error(err)
      alert('Wallet connection failed: ' + (err.message || err))
    }
  }

  // ------- rest of your functions (startRound, submitPaidEntry) remain unchanged -------
  // …

  return (
    <>
      <Head><title>MadFill</title></Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>MadFill</h1>
        <button onClick={connectWallet} style={{ marginBottom: '1rem' }}>
          {signer ? `👛 ${address}` : 'Connect Wallet'}
        </button>
        {/* Start Round & Submit Paid Entry sections… */}
      </main>
    </>
  )
}
