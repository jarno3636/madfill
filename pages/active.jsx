// pages/active.jsx
import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '../abi/FillInStoryV3_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'
import Image from 'next/image'
import { fetchFarcasterProfile } from '@/lib/neynar'
import { motion } from 'framer-motion'

export default function ActivePools() {
  const [rounds, setRounds] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [baseUsd, setBaseUsd] = useState(0)
  const [fallbackPrice, setFallbackPrice] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [likes, setLikes] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('madfillLikes') || '{}')
    }
    return {}
  })
  const roundsPerPage = 6

  // Load BASE price with Coinbase -> CoinGecko -> Alchemy -> $3800 fallback
  const loadPrice = async () => {
    let price = 0
    try {
      // 1️⃣ Try Coinbase ETH-USD spot (as BASE equivalent)
      const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')
      const cbJson = await cbRes.json()
      const cbPrice = parseFloat(cbJson?.data?.amount)
      if (cbPrice && cbPrice > 0.5) {
        console.log(`💰 Price source: Coinbase (${cbPrice} USD)`)
        setBaseUsd(cbPrice)
        setFallbackPrice(false)
        return cbPrice
      }
      throw new Error('Invalid Coinbase price')
    } catch (e) {
      console.warn('Coinbase failed, trying CoinGecko...', e)
    }

    try {
      // 2️⃣ Try CoinGecko
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=l2-standard-bridged-weth-base&vs_currencies=usd')
      const json = await res.json()
      price = json['l2-standard-bridged-weth-base']?.usd
      if (price && price > 0.5) {
        console.log(`💰 Price source: CoinGecko (${price} USD)`)
        setBaseUsd(price)
        setFallbackPrice(false)
        return price
      }
      throw new Error('Invalid CoinGecko price')
    } catch (e) {
      console.warn('CoinGecko failed, trying Alchemy...', e)
    }

    try {
      // 3️⃣ Try Alchemy token metadata
      const alchemyRes = await fetch(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'alchemy_getTokenMetadata',
            params: ['0x4200000000000000000000000000000000000006']
          })
        }
      )
      const data = await alchemyRes.json()
      price = data?.result?.price?.usd
      if (price && price > 0.5) {
        console.log(`💰 Price source: Alchemy (${price} USD)`)
        setBaseUsd(price)
        setFallbackPrice(false)
        return price
      }
      throw new Error('Invalid Alchemy price')
    } catch (e) {
      console.warn('Alchemy failed, falling back to $3800...', e)
      // 4️⃣ Fallback to manual price
      console.log('💰 Price source: Fallback (~3800 USD)')
      price = 3800
      setBaseUsd(price)
      setFallbackPrice(true)
      return price
    }
  }

  const loadRounds = async (priceOverride) => {
    const priceToUse = priceOverride || baseUsd
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
    const count = await ct.pool1Count()
    const now = Math.floor(Date.now() / 1000)
    const all = []

    for (let i = 1; i <= count; i++) {
      try {
        const info = await ct.getPool1Info(BigInt(i))
        const name = info[0]
        const theme = info[1]
        const parts = info[2]
        const feeBase = Number(info[3]) / 1e18
        const deadline = Number(info[4])
        const participants = info[6]
        const claimed = info[8]

        if (!claimed && deadline > now) {
          const avatars = await Promise.all(
            participants.map(async (addr) => {
              const res = await fetchFarcasterProfile(addr)
              return {
                address: addr,
                avatar: res?.pfp_url || '/Capitalize.PNG',
                fallbackUsername: res?.username || addr.slice(2, 6).toUpperCase()
              }
            })
          )

          const submissions = await Promise.all(
            participants.map(async (addr) => {
              try {
                const [username, word] = await ct.getPool1Submission(i, addr)
                return { address: addr, username, word }
              } catch {
                return { address: addr, username: '', word: '' }
              }
            })
          )

          const estimatedUsd = priceToUse * participants.length * feeBase

          all.push({
            id: i,
            name: name || 'Untitled',
            theme,
            parts,
            feeBase: feeBase.toFixed(4),
            deadline,
            count: participants.length,
            usd: estimatedUsd.toFixed(2),
            usdApprox: fallbackPrice,
            participants: avatars,
            submissions,
            badge: deadline - now < 3600 ? '🔥 Ends Soon' : estimatedUsd > 5 ? '💰 Top Pool' : null,
            emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][i % 5]
          })
        }
      } catch (e) {
        console.warn(`Error loading round ${i}`, e)
      }
    }

    setRounds(all)
  }

  useEffect(() => {
    const loadData = async () => {
      const price = await loadPrice()
      await loadRounds(price)
    }
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, filter])

  const handleLike = (roundId, submissionIdx) => {
    const key = `${roundId}-${submissionIdx}`
    const updated = { ...likes, [key]: !likes[key] }
    setLikes(updated)
    localStorage.setItem('madfillLikes', JSON.stringify(updated))
  }

  const filtered = rounds.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unclaimed') ||
      (filter === 'high' && parseFloat(r.usd) >= 5)
    return matchesSearch && matchesFilter
  })

  const sorted = filtered.sort((a, b) => {
    if (sortBy === 'deadline') return a.deadline - b.deadline
    if (sortBy === 'participants') return b.count - a.count
    if (sortBy === 'prize') return b.usd - a.usd
    return b.id - a.id
  })

  const totalPages = Math.ceil(sorted.length / roundsPerPage)
  const paginated = sorted.slice((page - 1) * roundsPerPage, page * roundsPerPage)

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-4xl font-extrabold text-white drop-shadow">🧠 Active Rounds</h1>

        {/* --- rest of your JSX unchanged --- */}
      </main>
    </Layout>
  )
}
