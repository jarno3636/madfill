// pages/active-rounds.jsx
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { Interface } from 'ethers/lib/utils'
import abi from '../abi/FillInStoryFull.json'

export default function ActiveRoundsPage() {
  const [rounds, setRounds] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const API_KEY = process.env.NEXT_PUBLIC_BASESCAN_API_KEY
        const ADDRESS = process.env.NEXT_PUBLIC_FILLIN_ADDRESS
        if (!API_KEY) throw new Error('Missing BASESCAN API key')
        if (!ADDRESS) throw new Error('Missing contract address')
        const iface = new Interface(abi)

        // figure out our “safe window” of blocks to scan
        const nowBlockRes = await fetch(`https://api.basescan.org/api?module=proxy&action=eth_blockNumber&apikey=${API_KEY}`)
        const latestBlock = parseInt(await nowBlockRes.json().then(d => d.result), 16)
        const windowSize  = 200_000
        const deployed    = Number(process.env.NEXT_PUBLIC_START_BLOCK) || 0
        const fromBlock   = Math.max(deployed, latestBlock - windowSize)

        async function fetchLogs(eventName) {
          const topic0 = iface.getEventTopic(eventName)
          const url = new URL('https://api.basescan.org/api')
          url.searchParams.set('module',    'logs')
          url.searchParams.set('action',    'getLogs')
          url.searchParams.set('fromBlock', fromBlock.toString())
          url.searchParams.set('toBlock',   'latest')
          url.searchParams.set('address',   ADDRESS)
          url.searchParams.set('topic0',    topic0)
          url.searchParams.set('apikey',    API_KEY)

          const res = await fetch(url)
          const json = await res.json()
          if (json.status !== '1') {
            // no logs or error
            return []
          }
          return json.result.map(log =>
            iface.parseLog({
              topics:    log.topics,
              data:      log.data,
              // ethers needs these two to parse, but it only cares about topics+data
              address:   ADDRESS,
              blockHash: log.blockHash,
              blockNumber: parseInt(log.blockNumber,16),
              transactionHash: log.transactionHash,
              logIndex: parseInt(log.logIndex,16),
              transactionIndex: 0
            }).args
          )
        }

        // pull events
        const [startedArgs, paidArgs] = await Promise.all([
          fetchLogs('Started'),
          fetchLogs('Paid')
        ])

        // tally pools
        const poolCounts = paidArgs.reduce((m, ev) => {
          const id = Number(ev.id)
          m[id] = (m[id] || 0) + 1
          return m
        }, {})

        // build your open rounds list
        const now = Math.floor(Date.now()/1000)
        const open = startedArgs
          .map(ev => ({
            id:        Number(ev.id),
            blanks:    Number(ev.blanks),
            deadline:  Number(ev.deadline),
            poolCount: poolCounts[Number(ev.id)] || 0
          }))
          .filter(r => r.deadline > now)

        setRounds(open)
      } catch (e) {
        console.error(e)
        setError(e.message || 'Failed to load rounds')
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

        {error && (
          <p className="text-center text-red-500">
            ⚠️ Unable to load active rounds: {error}
          </p>
        )}

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
