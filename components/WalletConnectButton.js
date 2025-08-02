// components/WalletConnectButton.jsx
import { useState, useEffect } from 'react'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

export default function WalletConnectButton({ onConnect }) {
  const [address, setAddress] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('walletAddress')
    if (saved) setAddress(saved)
  }, [])

  async function connect() {
    const modal = new Web3Modal({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: { rpc: { 8453: 'https://mainnet.base.org' }, chainId: 8453 },
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
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setAddress(addr)
      localStorage.setItem('walletAddress', addr)
      if (onConnect) onConnect({ address: addr, signer })
    } catch (err) {
      console.error('Wallet connect error:', err)
    }
  }

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  return (
    <button
      onClick={connect}
      className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition text-white shadow"
    >
      {short ? `👛 ${short}` : 'Connect Wallet'}
    </button>
  )
}
