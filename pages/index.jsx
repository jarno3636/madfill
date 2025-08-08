// pages/index.jsx
'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import abi from '../abi/FillInStoryV3_ABI.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { categories, durations } from '../data/templates'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { fetchFarcasterProfile } from '@/lib/neynar'
import ShareBar from '@/components/ShareBar'

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x6975a550130642E5cb67A87BE25c8134542D5a0a'

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
const BASE_CHAIN_ID_HEX = '0x2105' // 8453

export default function Home() {
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const loggerRef = useRef(null)

  const [address, setAddress] = useState(null)
  const [isOnBase, setIsOnBase] = useState(true)

  const [roundId, setRoundId] = useState('')
  const [roundName, setRoundName] = useState('')
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState(0)

  const [word, setWord] = useState('')
  const [duration, setDuration] = useState(durations[0].value)
  const [feeEth, setFeeEth] = useState(0.01) // in ETH on Base
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [createdShareUrl, setCreatedShareUrl] = useState('')
  const [createdShareText, setCreatedShareText] = useState('')

  const { width, height } = useWindowSize()

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx] // { name, parts, blanks }

  // ---------- utils ----------
  const log = (msg) => {
    setLogs((prev) => [...prev, msg])
    setTimeout(() => {
      if (loggerRef.current) {
        loggerRef.current.scrollTop = loggerRef.current.scrollHeight
      }
    }, 50)
  }

  function sanitizeWord(raw) {
    // one token (letters/numbers/_/-), max 16 chars
