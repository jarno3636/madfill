import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'

export default function Layout({ children }) {
  const [address, setAddress] = useState(null)
  const [signer, setSigner] = useState(null)

  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress) {
      connectWallet()
    }
  }, [])

  async function connectWallet() {
    const modal = new Web3Modal({
      cacheProvider: true,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            rpc: { 8453: 'https://mainnet.base.org' },
            chainId: 8453,
          },
        },
      },
    })

    try {
      const instance = await modal.connect()
      await instance.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })
      const provider = new ethers.BrowserProvider(instance)
      const _signer = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (e) {
      console.error('Wallet connect error:', e)
    }
  }

  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white relative">
      {/* Floating Wallet Button */}
      <button
        onClick={connectWallet}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-full shadow-xl whitespace-nowrap"
      >
        {address ? `👛 ${truncate(address)}` : 'Connect Wallet'}
      </button>

      {/* Navbar */}
      <nav className="flex flex-wrap justify-between items-center p-6 shadow-xl bg-slate-950 border-b border-indigo-700 gap-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight cursor-pointer hover:text-indigo-300 transition drop-shadow-md">
          <Link href="/">🧠 MadFill</Link>
        </h1>

        <div className="flex flex-wrap gap-4 items-center text-sm font-medium">
          <Link href="/" className="hover:text-indigo-300">Home</Link>
          <Link href="/active" className="hover:text-indigo-300">Active Rounds</Link>
          <Link href="/vote" className="hover:text-indigo-300">Community Vote</Link>
          <Link href="/myrounds" className="hover:text-green-300 font-semibold">🏆 My Rounds</Link>
          <Link href="/myo" className="hover:text-yellow-300 font-semibold">🎨 Make Your Own</Link>
          <Link href="/free" className="hover:text-pink-400 font-semibold">🎁 Free Game</Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {children}
      </main>
    </div>
  )
}
