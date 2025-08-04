// pages/challenge.jsx
import { useEffect, useState, Fragment } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import Layout from '@/components/Layout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import abi from '@/abi/FillInStoryFull.json'
import { categories } from '@/data/templates'
import Link from 'next/link'

export default function ChallengePage() {
  const [roundId, setRoundId]           = useState('')
  const [originalPreview, setOriginal]  = useState('')
  const [originalBlank, setOriginalBlank] = useState(0)
  const [catIdx, setCatIdx]             = useState(0)
  const [tplIdx, setTplIdx]             = useState(0)
  const [blankIndex, setBlankIndex]     = useState('0')
  const [word, setWord]                 = useState('')
  const [status, setStatus]             = useState('')
  const [busy, setBusy]                 = useState(false)

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  // 1) Whenever roundId changes, fetch the very first Paid event to build the "original" preview
  useEffect(() => {
    if (!roundId) {
      setOriginal('')
      return
    }

    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const ct = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi,
          provider
        )

        // fetch all Paid events for this round
        const paidEvents = await ct.queryFilter(
          ct.filters.Paid(BigInt(roundId), null, null),
          0,
          'latest'
        )

        if (!paidEvents.length) {
          setOriginal('No original submission found yet.')
          return
        }

        // take the very first submission
        const e = paidEvents[0].args
        const origWord  = ethers.decodeBytes32String(e._bytes || e[2] || e.data)
        const origBlank = e._i?.toNumber ? e._i.toNumber() : e._i || 0
        const tmplIndex = e._tmpl?.toNumber ? e._tmpl.toNumber() : 0

        // find which template that was
        let found = false
        categories.forEach((cat, ci) => {
          cat.templates.forEach((t, ti) => {
            if (t.id === paidEvents[0].topics[1]) {
              catIdx === ci && tplIdx === ti
            }
          })
        })

        // build a quick preview string
        const parts  = tpl.parts
        const blanks = tpl.blanks
        const preview = parts
          .map((p, i) =>
            i === origBlank
              ? p + origWord
              : i < blanks
              ? p + '____'
              : p
          )
          .join('')

        setOriginal(preview)
        setOriginalBlank(origBlank)
      } catch (err) {
        console.warn('Failed to load original submission:', err)
        setOriginal('Couldn’t fetch original submission.')
      }
    })()
  }, [roundId])

  async function handleSubmit() {
    if (!roundId || !word) return
    if (!window.ethereum) {
      setStatus('❌ No web3 provider')
      return
    }

    try {
      setBusy(true)
      setStatus('Submitting your challenger card…')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const ct       = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi,
        signer
      )

      const data = ethers.encodeBytes32String(word)
      const tx   = await ct.submitFree(
        BigInt(roundId),
        Number(blankIndex),
        data
      )
      await tx.wait()

      setStatus(`✅ Challenger submitted to round #${roundId}`)
    } catch (err) {
      console.error(err)
      setStatus('❌ ' + (err.message || 'Submission failed'))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = active =>
    `inline-block w-8 text-center border-b-2 ${
      active ? 'border-white' : 'border-slate-400'
    } cursor-pointer mx-1`

  return (
    <Layout>
      <Head>
        <title>Submit a Challenger | MadFill</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white px-4 py-6">
        <h1 className="text-3xl font-bold mb-4">😆 Submit a Challenger Card</h1>

        <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-xl mb-6">
          <CardHeader>
            <h2 className="text-xl font-bold">How It Works</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Think you can out-funny the original? Submit your word and challenge the crowd!</p>
            <p>After submissions close, the community votes between the Original & Challenger to pick a winner.</p>
            <p className="text-yellow-300">💡 Spread the word and get your friends to vote for your challenger!</p>
            <p className="text-xs mt-1">
              Want to vote instead?{' '}
              <Link href="/vote">
                <a className="underline text-indigo-300">Go to Community Vote</a>
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-lg font-semibold">Challenger Card Form</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Round ID */}
            <div>
              <label>Round ID</label>
              <input
                type="text"
                className="block w-full bg-slate-800 border rounded px-2 py-1 mt-1"
                value={roundId}
                onChange={e => setRoundId(e.target.value)}
              />
            </div>

            {/* Original preview */}
            {originalPreview && (
              <div className="bg-slate-800 border border-slate-700 rounded p-3 text-sm italic">
                📝 Original: {originalPreview}
              </div>
            )}

            {/* Category & Template selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Category', catIdx, setCatIdx, categories.map((c,i)=>({label:c.name,value:i}))],
                ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t,i)=>({label:t.name,value:i}))]
              ].map(([lbl, val, fn, opts]) => (
                <div key={lbl}>
                  <label>{lbl}</label>
                  <select
                    className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1"
                    value={val}
                    onChange={e=>fn(+e.target.value)}
                  >
                    {opts.map(o=>(
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Blank picker */}
            <div>
              <label>Pick Blank</label>
              <div className="bg-slate-800 border border-slate-700 rounded p-4 font-mono text-sm">
                {tpl.parts.map((part,i)=>(
                  <Fragment key={i}>
                    <span>{part}</span>
                    {i < tpl.blanks && (
                      <span
                        className={blankStyle(i===+blankIndex)}
                        onClick={()=>setBlankIndex(String(i))}
                      >{i}</span>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Your word */}
            <div>
              <label>Your Word</label>
              <input
                type="text"
                className="block w-full mt-1 bg-slate-800 border rounded px-2 py-1"
                value={word}
                onChange={e=>setWord(e.target.value)}
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={busy || !roundId || !word}
              className="bg-blue-600 hover:bg-blue-500 w-full"
            >
              🚀 Submit Challenger Card
            </Button>

            {status && <p className="text-sm mt-2">{status}</p>}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
