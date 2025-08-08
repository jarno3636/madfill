// components/WalletConnectButton.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

const BASE_CHAIN_ID_DEC = 8453
const BASE_CHAIN_ID_HEX = '0x2105'
const BASE_RPC = 'https://mainnet.base.org'
const BASE_EXPLORER = 'https://basescan.org'

export default function WalletConnectButton({
  onConnect,
  onDisconnect,
  className = '',
  buttonClassName = '',
  showNetworkPill = true,
}) {
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [open, setOpen] = useState(false)

  const modalRef = useRef(null)
  const instanceRef = useRef(null)

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

  const explorerUrl = useMemo(
    () => (address ? `${BASE_EXPLORER}/address/${address}` : '#'),
    [address]
  )

  function getWeb3Modal() {
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

  // Try to restore from cache / injected
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w3m = getWeb3Modal()
    if (w3m.cachedProvider || window.ethereum?.selectedAddress) {
      connect().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wallet event listeners
  useEffect(() => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.on) return
    const onAccountsChanged = async (accs) => {
      const a = Array.isArray(accs) ? accs[0] : null
      if (!a) {
        handleDisconnect()
        return
      }
      setAddress(a)
      try {
        const p = new ethers.BrowserProvider(eth)
        const s = await p.getSigner()
        setProvider(p)
        setSigner(s)
        onConnect?.({ address: a, signer: s, provider: p })
      } catch {}
    }
    const onChainChanged = async () => {
      try {
        await ensureBase(eth)
      } catch {}
    }
    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged)
      eth.removeListener?.('chainChanged', onChainChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConnect])

  async function ensureBase(ethLike) {
    try {
      await ethLike.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      })
      return true
    } catch (e) {
      // Add chain if missing
      if (e?.code === 4902 || /Unrecognized chain ID/i.test(e?.message || '')) {
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
      }
      throw e
    }
  }

  async function connect() {
    try {
      let ethLike = null
      if (window?.ethereum) {
        ethLike = window.ethereum
      } else {
        const w3m = getWeb3Modal()
        const instance = await w3m.connect()
        instanceRef.current = instance
        ethLike = instance
      }

      await ensureBase(ethLike)

      const p = new ethers.BrowserProvider(ethLike)
      const net = await p.getNetwork()
      if (net.chainId !== BigInt(BASE_CHAIN_ID_DEC)) {
        await ensureBase(ethLike)
      }

      const s = await p.getSigner()
      const a = await s.getAddress()

      setProvider(p)
      setSigner(s)
      setAddress(a)
      setOpen(false)

      localStorage.setItem('walletAddress', a)
      onConnect?.({ address: a, signer: s, provider: p })
    } catch (err) {
      console.error('Wallet connect error:', err)
    }
  }

  async function handleDisconnect() {
    try {
      const w3m = getWeb3Modal()
      await w3m.clearCachedProvider()
    } catch {}
    try {
      if (instanceRef.current?.disconnect) {
        await instanceRef.current.disconnect()
      }
    } catch {}
    setAddress(null)
    setSigner(null)
    setProvider(null)
    setOpen(false)
    localStorage.removeItem('walletAddress')
    onDisconnect?.()
  }

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(address)
      setOpen(false)
    } catch {}
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {!address ? (
        <button
          onClick={connect}
          className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-full shadow-xl whitespace-nowrap ${buttonClassName}`}
        >
          Connect Wallet
        </button>
      ) : (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`px-3 py-1.5 bg-slate-900/80 border border-slate-700 hover:border-indigo-500 rounded-full shadow flex items-center gap-2 ${buttonClassName}`}
            title={address}
          >
            <img
              src={`https://effigy.im/a/${address}`}
              alt="avatar"
              className="w-6 h-6 rounded-full ring-1 ring-slate-700"
            />
            <span className="text-sm">{shortAddr(address)}</span>
            {showNetworkPill && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 border border-emerald-500">
                Base
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur p-2 z-50"
              onMouseLeave={() => setOpen(false)}
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
                onClick={copyAddr}
              >
                Copy address
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-800/70 text-sm text-red-300"
                onClick={handleDisconnect}
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
