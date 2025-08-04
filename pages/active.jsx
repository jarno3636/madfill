// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Head from 'next/head'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { utils } from 'ethers'
import abi from '../abi/FillInStoryFull.json'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const API_KEY  = process.env.NEXT_PUBLIC_BASESCAN_API_KEY
        const ADDRESS  = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        const FROM     = process.env.NEXT_PUBLIC_START_BLOCK || '33631502'
        const iface    = new utils.Interface(abi)

        // helper to call BaseScan logs endpoint
        async function fetchLogs(topic0) {
          const res = await axios.get('https://api.basescan.org/api', {
            params: {
              module:    'logs',
              action:    'getLogs',
              fromBlock: FROM,
              toBlock:   'latest',
              address:   ADDRESS,
              topic0,
              apikey:    API_KEY,
            }
          })
          if (res.data.status !== '1') {
            throw new Error(res.data.message || 'no logs')
          }
          return res.data.result.map(log => iface.parseLog(log).args)
        }

        // Started() topic
        const TOPIC_STARTED = iface.getEventTopic('Started')
        const startedArgs   = await fetchLogs(TOPIC_STARTED)

        // Paid() topic
        const TOPIC_PAID    = iface.getEventTopic('Paid')
        const paidArgs      = await fetchLogs(TOPIC_PAID)

        // tally pools
        const poolCounts = paidArgs.reduce((acc, ev) => {
          const id = Number(ev.id)
          acc[id] = (acc[id] || 0) + 1
          return acc
        }, {})

        // build open rounds
        const now = Math.floor(Date.now()/1000)
        const openRounds = startedArgs
          .map(ev => ({
            id:        Number(ev.id),
            blanks:    Number(ev.blanks),
            deadline:  Number(ev.deadline),
            poolCount: poolCounts[Number(ev.id)] || 0
          }))
          .filter(r => r.deadline > now)

        setRounds(openRounds)
      } catch (e) {
        console.error(e)
        setError('⚠️ Unable to load active rounds: ' + e.message)
        setRounds([])
      }
    })()
  }, [])

  return (
    <Layout>
      <Head><title>MadFill • Active Rounds</title></Head>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-extrabold text-center text-indigo-400">
          🏁 Active Rounds
        </h1>
        {error && <p className="text-red-500 text-center">{error}</p>}
        {rounds === null ? (
          <p className="text-center text-gray-500">Loading…</p>
        ) : rounds.length === 0 ? (
          <p className="text-center text-gray-500">No open rounds found.</p>
        ) : (
          rounds.map(r => (
            <Card key={r.id} className="bg-slate-800 text-white rounded-lg shadow">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl">Round #{r.id}</h2>
                  <p className="text-sm opacity-75">
                    {r.blanks} blank{r.blanks>1?'s':''} • {r.poolCount} entr{r.poolCount===1?'y':'ies'}
                  </p>
                </div>
                <Countdown targetTimestamp={r.deadline} />
              </CardHeader>
              <CardContent className="text-right">
                <Link href={`/round/${r.id}`}>
                  <a className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded">
                    View & Enter
                  </a>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </main>
      <Footer />
    </Layout>
  )
}
