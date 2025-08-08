// components/Layout.jsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'

const BASE_CHAIN_ID_DEC = 8453
const BASE_CHAIN_ID_HEX = '0x2105'
const BASE_RPC = 'https://mainnet.base.org'
const BASE_EXPLORER = 'https://basescan.org'

export default function Layout({ children }) {
  const router = useRouter()

  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const modalRef = useRef(null)
  const instanceRef = useRef(null)

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

  // Active nav style
  const isActive = (href) => router.pathname === href
  const navLink = (href, label, extra = '') =>
    <Link
      href={href}
      className={`hover:text-indigo-300 transition ${isActive(href) ? 'text-indigo-300' : 'text-slate-200'} ${extra}`}
    >
      {label}
    </Link>

  // Initialize Web3Modal lazily
  const getWeb3Modal = () => {
    if (!modalRef.current) {
      modalRef.current = new Web3Modal({
        cacheProvider: true,
        providerOptions: {
          walletconnect: {
            package: WalletConnectProvider,
            options: {
              rpc: { [BASE_CHAIN_ID_DEC]: BASE_RPC },
              chainId: BASE_CHAIN_ID_DEC,
            },
          },
        },
      })
    }
    return modalRef.current
  }

  // Attempt auto-connect if cached
  useEffect(() => {
    if (typeof window === 'undefined') return
    const modal = getWeb3Modal()
    if (modal.cachedProvider || window.ethereum?.selectedAddress) {
      connectWallet().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen to wallet events
  useEffect(() => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.on) return
    const onAccounts = (accs) => {
      const a = Array.isArray(accs) ? accs[0] : null
      setAddress(a || null)
      if (!a) {
        setSigner(null)
        setProvider(null)
      }
    }
    const onChain = async (_chainId) => {
      // Force Base
      try {
        const p = new ethers.BrowserProvider(eth)
        const net = await p.getNetwork()
        if (net.chainId !== BigInt(BASE_CHAIN_ID_DEC)) {
          await switchToBase(eth)
        }
      } catch {}
    }
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccounts)
        eth.removeListener?.('chainChanged', onChain)
      } catch {}
    }
  }, [])

  async function ensureBase(ethLike) {
    try {
      await ethLike.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      return true
    } catch (e) {
      if (e?.code === 4902) {
        try {
          await ethLike.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID_HEX,
              chainName: 'Base',
              rpcUrls: [BASE_RPC],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: [BASE_EXPLORER],
            }],
          })
          return true
        } catch (err) {
          console.error('add chain failed', err)
          return false
        }
      }
      // Some wallets need add first even if they claim 4902
      try {
        await ethLike.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            rpcUrls: [BASE_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: [BASE_EXPLORER],
          }],
        })
        return true
      } catch (err) {
        console.error('switch chain failed', e)
        return false
      }
    }
  }

  async function switchToBase(ethLike) {
    return ensureBase(ethLike)
  }

  async function connectWallet() {
    try {
      let ethLike = null
      // Prefer existing injected if present
      if (window?.ethereum) {
        ethLike = window.ethereum
      } else {
        // Fall back to Web3Modal
        const modal = getWeb3Modal()
        const instance = await modal.connect()
        instanceRef.current = instance
        ethLike = instance
      }

      // Force Base
      await ensureBase(ethLike)

      const browserProvider = new ethers.BrowserProvider(ethLike)
      const net = await browserProvider.getNetwork()
      if (net.chainId !== BigInt(BASE_CHAIN_ID_DEC)) {
        // Try once more
        await ensureBase(ethLike)
      }

      const s = await browserProvider.getSigner()
      const a = await s.getAddress()

      setProvider(browserProvider)
      setSigner(s)
      setAddress(a)
      setMenuOpen(false)
    } catch (e) {
      console.error('Wallet connect error:', e)
    }
  }

  async function disconnectWallet() {
    try {
      const modal = getWeb3Modal()
      await modal.clearCachedProvider()
    } catch {}
    try {
      if (instanceRef.current?.disconnect) {
        await instanceRef.current.disconnect()
      }
    } catch {}
    setAddress(null)
    setSigner(null)
    setProvider(null)
    setMenuOpen(false)
  }

  const explorerLink = useMemo(
    () => (address ? `${BASE_EXPLORER}/address/${address}` : '#'),
    [address]
  )

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-950 min-h-screen text-white relative">
      {/* Floating Wallet Button / Menu */}
      <div className="fixed top-4 right-4 z-50">
        {!address ? (
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-full shadow-xl whitespace-nowrap"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-3 py-1.5 bg-slate-900/80 border border-slate-700 hover:border-indigo-500 rounded-full shadow flex items-center gap-2"
              title={address}
            >
              <img
                src={`https://effigy.im/a/${address}`}
                alt="avatar"
                className="w-6 h-6 rounded-full ring-1 ring-slate-700"
              />
              <span className="text-sm">{shortAddr(address)}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 border border-emerald-500 ml-1">
                Base
              </span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur p-2"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <a
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800/70 text-sm"
                  href={explorerLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Basescan <span>↗</span>
                </a>
                <button
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-800/70 text-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(address).catch(() => {})
                    setMenuOpen(false)
                  }}
                >
                  Copy address
                </button>
                <button
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-800/70 text-sm text-red-300"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navbar */}
      <nav className="flex flex-wrap justify-between items-center p-6 shadow-xl bg-slate-950/90 border-b border-indigo-700 gap-y-2 sticky top-0 z-40 backdrop-blur">
        <h1 className="text-2xl font-extrabold tracking-tight cursor-pointer hover:text-indigo-300 transition drop-shadow-md">
          <Link href="/">🧠 MadFill</Link>
        </h1>

        <div className="flex flex-wrap gap-4 items-center text-sm font-medium">
          {navLink('/', 'Home')}
          {navLink('/active', 'Active Rounds')}
          {navLink('/vote', 'Community Vote')}
          {navLink('/myrounds', '🏆 My Rounds', 'font-semibold')}
          {navLink('/myo', '🎨 Make Your Own', 'font-semibold')}
          {navLink('/free', '🎁 Free Game', 'font-semibold')}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {children}
      </main>
    </div>
  )
}
