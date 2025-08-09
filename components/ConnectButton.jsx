// components/ConnectButton.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

const BASE = {
  idDec: 8453,
  idHex: '0x2105',
  rpc: 'https://mainnet.base.org',
  explorer: 'https://basescan.org',
}

export default function ConnectButton({
  className = '',
  buttonClassName = '',
  showNetworkPill = true,
}) {
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const modalRef = useRef(null)
  const instanceRef = useRef(null)

  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const explorerUrl = useMemo(
    () => (address ? `${BASE.explorer}/address/${address}` : '#'),
    [address]
  )

  function getModal() {
    if (!modalRef.current) {
      modalRef.current = new Web3Modal({
        cacheProvider: true,
        providerOptions: {
          walletconnect: {
            package: WalletConnectProvider,
            options: {
              rpc: { [BASE.idDec]: BASE.rpc },
              chainId: BASE.idDec,
            },
          },
        },
      })
    }
    return modalRef.current
  }

  // Restore from cache/injected
  useEffect(() => {
    const init = async () => {
      const w3m = getModal()
      if (w3m.cachedProvider || window?.ethereum?.selectedAddress) {
        try {
          await connect()
        } catch {}
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to wallet events
  useEffect(() => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.on) return
    const onAccountsChanged = async (accs) => {
      const a = Array.isArray(accs) ? accs[0] : null
      if (!a) {
        await disconnect()
        return
      }
      setAddress(a)
    }
    const onChainChanged = async () => {
      try { await ensureBase(eth) } catch {}
    }
    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccountsChanged)
        eth.removeListener?.('chainChanged', onChainChanged)
      } catch {}
    }
  }, [])

  async function ensureBase(ethLike) {
    try {
      await ethLike.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE.idHex }],
      })
      return true
    } catch (e) {
      if (e?.code === 4902 || /Unrecognized chain ID/i.test(e?.message || '')) {
        await ethLike.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE.idHex,
            chainName: 'Base',
            rpcUrls: [BASE.rpc],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: [BASE.explorer],
          }],
        })
        return true
      }
      throw e
    }
  }

  async function connect() {
    setBusy(true)
    try {
      let ethLike = null
      if (window?.ethereum) {
        ethLike = window.ethereum
      } else {
        const w3m = getModal()
        const instance = await w3m.connect()
        instanceRef.current = instance
        ethLike = instance
      }

      // Force Base
      await ensureBase(ethLike)

      const browserProvider = new ethers.BrowserProvider(ethLike)
      const signer = await browserProvider.getSigner()
      const addr = await signer.getAddress()

      setProvider(browserProvider)
      setAddress(addr)
      localStorage.setItem('walletAddress', addr)
    } catch (e) {
      // swallow; user may cancel
      console.warn('connect error', e)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    try {
      const w3m = getModal()
      await w3m.clearCachedProvider()
    } catch {}
    try { await instanceRef.current?.disconnect?.() } catch {}
    setAddress(null)
    setProvider(null)
    localStorage.removeItem('walletAddress')
    setMenuOpen(false)
  }

  async function copy() {
    try { await navigator.clipboard.writeText(address) } catch {}
    setMenuOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      {!address ? (
        <button
          onClick={connect}
          disabled={busy}
          className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium rounded-full shadow ${buttonClassName}`}
        >
          {busy ? 'Connecting…' : 'Connect Wallet'}
        </button>
      ) : (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`px-3 py-1.5 bg-slate-900/80 border border-slate-700 hover:border-indigo-500 rounded-full shadow flex items-center gap-2 ${buttonClassName}`}
            title={address}
          >
            <img
              src={`https://effigy.im/a/${address}`}
              alt="avatar"
              className="w-6 h-6 rounded-full ring-1 ring-slate-700"
            />
            <span className="text-sm">{short(address)}</span>
            {showNetworkPill && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 border border-emerald-500">
                Base
              </span>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur p-2 z-50"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <a
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800/70 text-sm"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Basescan <span>↗</span>
              </a>
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-800/70 text-sm"
                onClick={copy}
              >
                Copy address
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-800/70 text-sm text-red-300"
                onClick={disconnect}
              >
                Disconnect
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
