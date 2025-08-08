// lib/useWallet.js
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useMemo } from 'react'
import { BASE } from './chain'

export function useWallet() {
  const account = useAccount()
  const { connectors, connectAsync, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, error: switchError } = useSwitchChain()

  const isOnBase = account.chainId === BASE.id
  const address = account.address || null
  const connected = account.status === 'connected'

  async function connectBest() {
    // Try Farcaster connector first if present, then Coinbase, then MetaMask
    const order = ['farcaster-miniapp', 'coinbase', 'metamask']
    for (const id of order) {
      const c = connectors.find((x) => x.id === id)
      if (!c) continue
      try {
        await connectAsync({ connector: c })
        return true
      } catch (e) {
        // try next
      }
    }
    // fallback: first available
    if (connectors[0]) {
      await connectAsync({ connector: connectors[0] })
      return true
    }
    throw new Error('No wallet connectors available')
  }

  async function ensureBase() {
    if (!connected) {
      await connectBest()
    }
    if (account.chainId !== BASE.id) {
      await switchChainAsync({ chainId: BASE.id })
    }
  }

  const short = useMemo(
    () => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''),
    [address]
  )

  return {
    address,
    short,
    connected,
    isOnBase,
    connectBest,
    disconnect,
    ensureBase,
    connectStatus,
    connectError,
    switchError,
  }
}
