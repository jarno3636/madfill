// pages/pool1/[id].jsx
'use client'

import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories } from '@/data/templates'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'

const FN = {
  info: 'getPool1Info',
  submission: 'getPool1Submission',
  join: 'joinPool1',
  claim: 'claimPool1',
}

const BASE_CHAIN_ID = 8453
const BASE_RPC = 'https://mainnet.base.org'

class UXError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UXError'
  }
}

export default function Pool1EntryPage() {
  const { query } = useRouter()
  const idParam = query?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roundData, setRoundData] = useState(null)
  const [address, setAddress] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [status, setStatus] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [ethUsd, setEthUsd] = useState(0)
  const [profiles, setProfiles] = useState({})
  const [copyOk, setCopyOk] = useState(false)
  const [entryWord, setEntryWord] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { width, height } = useWindowSize()
  const claimInFlight = useRef(false)

  const idBigInt = useMemo(() => {
    try {
      if (!idParam) return null
      const s = Array.isArray(idParam) ? idParam[0] : idParam
      if (!s) return null
      return BigInt(s)
    } catch {
      return null
    }
  }, [idParam])

  const roProvider = useMemo(() => new ethers.JsonRpcProvider(BASE_RPC), [])
  const contractRO = useMemo(() => {
    const addr = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
    if (!addr) return null
    return new ethers.Contract(addr, abi, roProvider)
  }, [roProvider])

  useEffect(() => {
    if (!window?.ethereum) return
    const eth = window.ethereum
    const init = async () => {
      try {
        const [acct] = await eth.request({ method: 'eth_accounts' })
        if (acct) setAddress(acct)
        const net = await eth.request({ method: 'eth_chainId' })
        if (net) setChainId(parseInt(net, 16))
      } catch {}
    }
    eth.on('accountsChanged', (accts) => setAddress(accts?.[0] || null))
    eth.on('chainChanged', (hexId) => setChainId(parseInt(hexId, 16)))
    init()
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!idBigInt || !contractRO) return
      setLoading(true)
      setError(null)
      try {
        const infoRaw = await contractRO[FN.info](idBigInt)
        const parsed = decodePool1Info(infoRaw)
        let origWord = ''
        try {
          if (contractRO[FN.submission] && parsed.creator) {
            const sub = await contractRO[FN.submission](idBigInt, parsed.creator)
            origWord = String(sub?.[0] || '')
          }
        } catch {}
        parsed.originalWord = origWord

        const tplIx = Number(localStorage.getItem(`madfill-tplIdx-${idBigInt}`)) || 0
        const catIx = Number(localStorage.getItem(`madfill-catIdx-${idBigInt}`)) || 0
        const nameLS = localStorage.getItem(`madfill-roundname-${idBigInt}`)
        const name = nameLS || parsed.name || 'Untitled'
        const tpl = categories?.[catIx]?.templates?.[tplIx]

        const buildPreview = (fillWord) => {
          if (!tpl?.parts?.length || typeof tpl?.blanks !== 'number') return `[...] ${fillWord || ''}`
          return tpl.parts.map((part, i) => (i === parsed.blankIndex ? part + (fillWord || '') : i < tpl.blanks ? part + '____' : part)).join('')
        }

        const previewText = buildPreview(parsed.originalWord)

        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
          const json = await res.json()
          if (json?.ethereum?.usd) setEthUsd(Number(json.ethereum.usd))
        } catch {}

        const profMap = {}
        const addAddr = async (addr) => {
          if (!addr) return
          const key = String(addr).toLowerCase()
          try { const p = await fetchFarcasterProfile(key); if (p) profMap[key] = p } catch {}
        }
        await Promise.allSettled([
          addAddr(parsed.creator),
          addAddr(parsed.winner),
          ...(parsed.participants || []).slice(0, 32).map(addAddr),
        ])

        if (!cancelled) {
          setProfiles(profMap)
          setRoundData({
            id: idBigInt.toString(),
            name,
            tpl,
            theme: parsed.theme,
            parts: parsed.parts,
            feeBase: parsed.feeBase,
            deadline: parsed.deadline,
            creator: parsed.creator?.toLowerCase() || null,
            participants: (parsed.participants || []).map((a) => String(a).toLowerCase()),
            winner: parsed.winner?.toLowerCase() || null,
            finished: parsed.finished,
            blankIndex: parsed.blankIndex,
            originalWord: parsed.originalWord,
            previewText,
          })
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load round')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [idBigInt, contractRO])

  const isBase = chainId === BASE_CHAIN_ID
  const hasEnded = roundData ? Number(roundData.deadline) < Math.floor(Date.now() / 1000) : false
  const userIsWinner = useMemo(() => address && roundData?.winner === address.toLowerCase(), [address, roundData])

  async function connectWallet() {
    if (!window?.ethereum) { setError('No wallet detected.'); return }
    try {
      const [acct] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAddress(acct || null)
      const hexId = await window.ethereum.request({ method: 'eth_chainId' })
      setChainId(parseInt(hexId, 16))
    } catch (e) { setError(e?.message) }
  }

  async function ensureBaseNetwork() {
    if (!window?.ethereum) throw new UXError('Wallet not found')
    const eth = window.ethereum
    const current = parseInt(await eth.request({ method: 'eth_chainId' }), 16)
    if (current === BASE_CHAIN_ID) return
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }) }
    catch (switchErr) {
      if (switchErr?.code === 4902) {
        await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x2105', chainName: 'Base', rpcUrls: [BASE_RPC], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] }] })
      } else { throw switchErr }
    }
  }

  async function handleEnter() {
    if (submitting) return
    try {
      if (!entryWord) throw new UXError('Please enter a word')
      if (!idBigInt) throw new UXError('Invalid round id')
      if (!window?.ethereum) throw new UXError('Wallet not found')
      if (hasEnded) throw new UXError('Entry closed')
      setSubmitting(true)
      setStatus('Preparing…')
      await ensureBaseNetwork()
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const addr = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
      if (!addr) throw new UXError('Contract address missing')
      const ct = new ethers.Contract(addr, abi, signer)
      const uname = profiles[address?.toLowerCase()]?.username || address?.slice(0, 6) || 'anon'
      const value = roundData?.feeBase ? roundData.feeBase : 0n
      const tx = await ct[FN.join](idBigInt, String(entryWord).trim(), String(uname), { value })
      setStatus('Waiting for confirmation…')
      await tx.wait()
      setStatus('✅ Submitted!')
      setEntryWord('')
    } catch (e) {
      setStatus('❌ ' + (e?.reason || e?.message))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClaim() {
    if (claimInFlight.current) return
    try {
      if (!userIsWinner) throw new UXError('Not eligible to claim')
      if (!hasEnded) throw new UXError('Pool not finished yet')
      if (!window?.ethereum) throw new UXError('Wallet not found')
      if (!idBigInt) throw new UXError('Invalid round id')
      setStatus('Claiming…')
      await ensureBaseNetwork()
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const addr = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
      const ct = new ethers.Contract(addr, abi, signer)
      claimInFlight.current = true
      const tx = await ct[FN.claim](idBigInt)
      setStatus('Waiting…')
      await tx.wait()
      setClaimed(true)
      setStatus('✅ Claimed!')
    } catch (e) {
      setStatus('❌ ' + (e?.reason || e?.message))
    } finally {
      claimInFlight.current = false
    }
  }

  function copyShare() {
    try {
      const url = window?.location.href || ''
      navigator.clipboard.writeText(url)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 1500)
    } catch {}
  }

  const shareText = useMemo(() => {
    const base = `Enter MadFill Pool 1 Round #${roundData?.id || ''}!`
    const url = window?.location.href || 'https://madfill.vercel.app'
    return encodeURIComponent(`${base} ${url}`)
  }, [roundData?.id])

  return (
    <Layout>
      <Head>
        <title>MadFill Pool 1 — Round #{roundData?.id || idParam || ''}</title>
      </Head>
      <main className="max-w-3xl mx-auto p-4 space-y-6 text-white">
        {loading && <p>Loading…</p>}
        {error && <p className="text-red-400">Error: {error}</p>}
        {roundData && (
          <>
            <Card className="bg-slate-900">
              <CardHeader className="text-center font-bold bg-slate-800">✍️ Submit Your Word</CardHeader>
              <CardContent>
                <input type="text" value={entryWord} onChange={(e) => setEntryWord(e.target.value)} />
                <Button onClick={handleEnter} disabled={hasEnded || submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900">
              <CardHeader>😂 Original Card</CardHeader>
              <CardContent>{roundData.previewText}</CardContent>
            </Card>

            {hasEnded && userIsWinner && !claimed && <Button onClick={handleClaim}>🎁 Claim</Button>}
            {claimed && <p>✅ Prize Claimed!</p>}
            {status && <p>{status}</p>}

            <div>
              Share: <a href={`https://twitter.com/intent/tweet?text=${shareText}`}>Twitter</a>
              <button onClick={copyShare}>{copyOk ? 'Copied!' : 'Copy link'}</button>
            </div>

            {claimed && <Confetti width={width} height={height} />}
          </>
        )}
      </main>
    </Layout>
  )
}

function decodePool1Info(arr) {
  return {
    name: String(arr?.[0] ?? ''),
    theme: String(arr?.[1] ?? ''),
    parts: Array.isArray(arr?.[2]) ? arr[2] : [],
    feeBase: arr?.[3] !== undefined ? BigInt(arr[3]) : 0n,
    deadline: Number(arr?.[4] ?? 0),
    creator: arr?.[5] || null,
    participants: Array.isArray(arr?.[6]) ? arr[6] : [],
    winner: arr?.[7] || null,
    finished: Boolean(arr?.[8]),
    blankIndex: Number(arr?.[9] ?? 0),
    originalWord: ''
  }
}
