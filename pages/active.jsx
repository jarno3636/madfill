// pages/active.jsx
import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Head from 'next/head'
import abi from '../abi/FillInStoryV2_ABI.json'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/Countdown'
import Link from 'next/link'

export default function ActivePools() {
  const [rounds, setRounds] = useState([])

  useEffect(() => {
    const loadRounds = async () => {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

      const count = await ct.pool1Count()
      const all = []

      for (let i = 0; i < count; i++) {
        try {
          const info = await ct.getPool1Info(i)
          if (!info.claimed && Number(info.deadline) > Date.now() / 1000) {
            all.push({
              id: i,
              name: localStorage.getItem(`madfill-roundname-${i}`) || info.name || 'Untitled',
              feeUsd: Number(info.feeUsd),
              deadline: Number(info.deadline),
              participants: info.participants,
            })
          }
        } catch (e) {
          console.warn(`Error loading round ${i}`, e)
        }
      }

      setRounds(all)
    }

    loadRounds()
  }, [])

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-white">🔥 Active Rounds</h1>

        {rounds.length === 0 ? (
          <p className="text-white">No active rounds right now. Be the first to start one!</p>
        ) : (
          rounds.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white shadow rounded-lg">
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{r.name}</h2>
                <Countdown deadline={r.deadline} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Fee:</strong> ~${r.feeUsd.toFixed(2)} USD</p>
                <p><strong>Participants:</strong> {r.participants.length}</p>
                <Link href={`/round/${r.id}`}>
                  <Button className="mt-2 bg-indigo-600 hover:bg-indigo-500">Enter Round</Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </Layout>
  )
}
