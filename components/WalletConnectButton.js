// components/WalletConnectButton.jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'
import { BASE } from '@/lib/chain' // central constants (see below)

export default function WalletConnectButton({
  onConnect,
  onDisconnect,
  onError,
  onAutoConnect,
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
    () => (address ? `${BASE.explorer}/address/${address}` : '#'),
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
              rpc: { [BASE.idDec]: BASE.rpc },
              chainId: BASE.idDec,
            },
          },
        },
      })
    }
    return modalRef.current
  }

  // Auto-connect if cached or injected has selectedAddress
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w3m = getWeb3Modal()
    const should = w3m.cachedProvider || window.ethereum?.selectedAddress
    if (should) {
      connect(true).catch((e) => onError?.(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach listeners to whichever provider is “active”
  useEffect(() => {
    const eth = instanceRef.current || (typeof window !== 'undefined' ? window.ethereum : null)
    if (!eth?.on) return

    const onAccountsChanged = async (accs) => {
      const a = Array.isArray(accs) ? accs[0] : null
      if (!a) {
        await handleDisconnect()
        return
      }
      setAddress(a)
      try {
        const p = new ethers.BrowserProvider(eth)
        const s = await p.getSigner()
        setProvider(p)
        setSigner(s)
        onConnect?.({ address: a, signer: s, provider: p })
      } catch (e) {
        onError?.(e)
      }
    }

    const onChainChanged = async () => {
      try {
        await ensureBase(eth)
      } catch (e) {
        onError?.(e)
      }
    }

    const onDisconnectEvt = async () => {
      // WalletConnect v1 sometimes fires disconnect after QR tab closes
      await handleDisconnect()
    }

    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)
    eth.on?.('disconnect', onDisconnectEvt)

    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccountsChanged)
        eth.removeListener?.('chainChanged', onChainChanged)
        eth.removeListener?.('disconnect', onDisconnectEvt)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConnect, onError])

  async function ensureBase(ethLike) {
    try {
      await ethLike.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE.idHex }],
      })
      return true
    } catch (e) {
      // Add chain if missing
      if (e?.code === 4902 || /Unrecognized chain ID/i.test(e?.message || '')) {
        await ethLike.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE.idHex,
            chainName: BASE.name,
            rpcUrls: [BASE.rpc],
            nativeCurrency: BASE.nativeCurrency,
            blockExplorerUrls: [BASE.explorer],
          }],
        })
        return true
      }
      throw e
    }
  }

  async function connect(isAuto = false) {
    try {
      let ethLike = null
      if (typeof window !== 'undefined' && window.ethereum) {
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
      if (net.chainId !== BigInt(BASE.idDec)) {
        await ensureBase(ethLike)
      }

      const s = await p.getSigner()
      const a = await s.getAddress()

      setProvider(p)
      setSigner(s)
      setAddress(a)
      setOpen(false)

      localStorage.setItem('walletAddress', a)
      if (isAuto) onAutoConnect?.({ address: a, signer: s, provider: p })
      onConnect?.({ address: a, signer: s, provider: p })
    } catch (err) {
      console.error('Wallet connect error:', err)
      onError?.(err)
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
          onClick={() => connect(false)}
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
              onError={(e) => { e.currentTarget.src = '/Capitalize.PNG' }}
            />
            <span className="text-sm">{shortAddr(address)}</span>
            {showNetworkPill && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 border border-emerald-500">
                {BASE.shortName}
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
