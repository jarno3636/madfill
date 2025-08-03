// pages/myo.jsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import abi from '@/abi/FillInStoryFull.json'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MyOPage() {
  const [address, setAddress] = useState(null)
  const [rounds, setRounds] = useState([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [signer, setSigner] = useState(null)

  useEffect(() => {
    if (!window.ethereum) return
    const provider = new ethers.BrowserProvider(window.ethereum)
    provider.getSigner().then(_signer => {
      _signer.getAddress().then(addr => {
        setSigner(_signer)
        setAddress(addr)
      })
    })
  }, [])

  useEffect(() => {
    if (!address) return
    const load = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const total = await ct.rounds.length
        const list = []

        for (let i = 0; i < total; i++) {
          try {
            const winner = await ct.w1(i)
            const claimed = await ct.c1(i)
            if (winner.toLowerCase() === address.toLowerCase()) {
              list.push({ id: i, claimed })
            }
          } catch (err) {
            console.warn('Skipping round', i)
          }
        }
        setRounds(list)
      } catch (err) {
        console.error('Error loading user rounds:', err)
      }
    }

    load()
  }, [address])

  async function handleClaim(id) {
    try {
      setBusy(true)
      setStatus(`⏳ Claiming prize for round ${id}...`)
      const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const tx = await ct.claim1(id)
      await tx.wait()
      setStatus(`✅ Prize claimed for round ${id}!`)
      setRounds(prev => prev.map(r => r.id === id ? { ...r, claimed: true } : r))
    } catch (err) {
      console.error(err)
      setStatus('❌ ' + (err.reason || err.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <Head><title>My Wins | MadFill</title></Head>
      <h1 className="text-2xl font-bold mb-4 text-white">🏆 My Winning Rounds</h1>

      {status && <p className="mb-4 text-sm">{status}</p>}

      {rounds.length === 0 ? (
        <p className="text-white">You haven’t won any rounds yet… keep playing!</p>
      ) : (
        <div className="space-y-4">
          {rounds.map(r => (
            <div key={r.id} className="bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-white">🎉 Round #{r.id}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/round/${r.id}`} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm">📜 View</Link>
                {!r.claimed ? (
                  <Button onClick={() => handleClaim(r.id)} disabled={busy} className="bg-green-600 hover:bg-green-500 text-sm">
                    💰 Claim Prize
                  </Button>
                ) : (
                  <span className="text-green-400 text-sm">✅ Claimed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
