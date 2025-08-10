// hooks/useMiniWallet.js
'use client'

import { useEffect, useState } from 'react'

export function useMiniAppEthereum() {
  const [provider, setProvider] = useState(null)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [address, setAddress] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let unsub = () => {}

    ;(async () => {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const inWarpcast = /Warpcast/i.test(ua)

      if (inWarpcast) {
        // ⚡ Mini App path (Warpcast)
        const { sdk } = await import('@farcaster/miniapp-sdk')
        setIsMiniApp(true)

        try { await sdk.actions.ready() } catch {}
        setReady(true)

        try {
          const prov = await sdk.wallet.getEthereumProvider() // EIP-1193 provider
          setProvider(prov)

          // Try silent account hydration (if already approved)
          try {
            const res = await sdk.wallet.requestEthereumAccounts({ silent: true })
            if (res?.addresses?.length) setAddress(res.addresses[0])
          } catch {}

          // Chain (Base is 0x2105)
          try {
            const cid = await prov.request?.({ method: 'eth_chainId' })
            if (cid) setChainId(cid)
          } catch {}

          const onAcct = (accs) => setAddress((accs && accs[0]) || null)
          const onChain = (cid) => setChainId(typeof cid === 'string' ? cid : String(cid))

          prov.on?.('accountsChanged', onAcct)
          prov.on?.('chainChanged', onChain)

          unsub = () => {
            prov.removeListener?.('accountsChanged', onAcct)
            prov.removeListener?.('chainChanged', onChain)
          }
        } catch {
          setProvider(null)
        }
        return
      }

      // 🌐 Browser fallback (injected)
      const injected = typeof window !== 'undefined' ? window.ethereum : null
      setProvider(injected || null)

      if (injected) {
        try {
          const accs = await injected.request({ method: 'eth_accounts' })
          setAddress((accs && accs[0]) || null)
        } catch {}
        try {
          const cid = await injected.request({ method: 'eth_chainId' })
          setChainId(cid || null)
        } catch {}

        const onAcct = (accs) => setAddress((accs && accs[0]) || null)
        const onChain = (cid) => setChainId(cid)

        injected.on?.('accountsChanged', onAcct)
        injected.on?.('chainChanged', onChain)
        unsub = () => {
          injected.removeListener?.('accountsChanged', onAcct)
          injected.removeListener?.('chainChanged', onChain)
        }
      }
    })()

    return () => unsub()
  }, [])

  // Call this from a button
  const connect = async () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const inWarpcast = /Warpcast/i.test(ua)

    if (inWarpcast) {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      try { await sdk.actions.ready() } catch {}
      const res = await sdk.wallet.requestEthereumAccounts() // shows Warpcast permission sheet
      if (res?.addresses?.length) {
        setAddress(res.addresses[0])
        if (!provider) {
          const prov = await sdk.wallet.getEthereumProvider()
          setProvider(prov)
        }
      }
      return
    }

    if (provider?.request) {
      const accs = await provider.request({ method: 'eth_requestAccounts' })
      setAddress((accs && accs[0]) || null)
    }
  }

  return { provider, isMiniApp, address, chainId, ready, connect }
}
