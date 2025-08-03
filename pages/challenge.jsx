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
  const [roundId, setRoundId] = useState('')
  const [originalPreview, setOriginalPreview] = useState(null)
  const [catIdx, setCatIdx] = useState(0)
  const [tplIdx, setTplIdx] = useState(0)
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedCategory = categories[catIdx]
  const tpl = selectedCategory.templates[tplIdx]

  useEffect(() => {
    if (!roundId) return
    let cancelled = false

    const load = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)
        const subs = await contract.getSubmissions(roundId)

        const orig = subs[0]
        const word = ethers.decodeBytes32String(orig.word)
        const idx = orig.blank.toString()
        const tmplIdx = parseInt(orig.template.toString())

        for (let i = 0; i < categories.length; i++) {
          const tIdx = categories[i].templates.findIndex(t => t.index === tmplIdx)
          if (tIdx !== -1) {
            setCatIdx(i)
            setTplIdx(tIdx)
            break
          }
        }

        const parts = categories[catIdx].templates[tplIdx].parts
        const blanks = categories[catIdx].templates[tplIdx].blanks
        const preview = parts.map((part, i) =>
          i === Number(idx) ? part + word : i < blanks ? part + '____' : part
        ).join('')

        if (!cancelled) setOriginalPreview(preview)
      } catch (err) {
        if (!cancelled) setOriginalPreview(null)
        console.warn('Could not load round info:', err)
      }
    }

    load()
    return () => { cancelled = true }
  }, [roundId, catIdx, tplIdx])

  async function handleSubmit() {
    try {
      if (!window.ethereum) throw new Error('Wallet not found')
      setBusy(true)
      setStatus('Submitting your challenger entry...')
      const modal = new ethers.BrowserProvider(window.ethereum)
      const signer = await modal.getSigner()
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, signer)
      const data = ethers.encodeBytes32String(word)
      const tx = await contract.submitFree(BigInt(roundId), Number(blankIndex), data)
      await tx.wait()
      setStatus(`✅ Challenger card submitted to round ${roundId}`)
    } catch (e) {
      setStatus('❌ ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active ? 'border-white' : 'border-slate-400'} cursor-pointer mx-1`

  return (
    <Layout>
      <Head><title>Submit a Challenger | MadFill</title></Head>
      <h1 className="text-3xl font-bold text-white mb-4">😆 Submit a Challenger Card</h1>

      <Card className="bg-gradient-to-tr from-purple-800 to-indigo-900 text-white shadow-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">How It Works</h2>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Think your version is funnier? Submit a Challenger Card and see if the community agrees!</p>
          <p>Voting will open between the Original and Challenger cards, and one side will win the prize pool.</p>
          <p className="text-yellow-300">💡 Invite your friends to vote for your card!</p>
          <p className="text-sm mt-2">Want to vote instead? <Link href="/vote" className="underline text-indigo-300">Go to Community Vote</Link></p>
        </CardContent>
      </Card>

      <Card className="mt-6 bg-slate-900 text-white shadow-lg">
        <CardHeader>
          <h2 className="text-lg font-semibold">Challenger Card Form</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label>Round ID</label>
            <input
              type="text"
              className="block w-full bg-slate-800 border rounded px-2 py-1 mt-1"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
            />
          </div>

          {originalPreview && (
            <div className="text-sm mt-2 p-3 rounded bg-slate-800 border border-slate-700">
              <p className="text-slate-400 mb-1">📝 Original Card Preview:</p>
              <p className="italic text-white">{originalPreview}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['Category', catIdx, setCatIdx, categories.map((c, i) => ({ label: c.name, value: i }))],
              ['Template', tplIdx, setTplIdx, selectedCategory.templates.map((t, i) => ({ label: t.name, value: i }))]].map(([label, val, setVal, options]) => (
              <div key={label}>
                <label>{label}</label>
                <select className="block w-full mt-1 bg-slate-800 text-white border rounded px-2 py-1" value={val} onChange={e => setVal(+e.target.value)}>
                  {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label>Choose Blank</label>
            <div className="bg-slate-800 border border-slate-600 rounded p-4 font-mono text-sm">
              {tpl.parts.map((part, i) => (
                <Fragment key={i}>
                  <span>{part}</span>
                  {i < tpl.blanks && (
                    <span className={blankStyle(i === +blankIndex)} onClick={() => setBlankIndex(String(i))}>{i}</span>
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          <div>
            <label>Your Word</label>
            <input
              type="text"
              className="block w-full mt-1 bg-slate-800 text-white border rounded px-2 py-1"
              value={word}
              onChange={e => setWord(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!roundId || !word || busy} className="bg-blue-600 hover:bg-blue-500">
            🚀 Submit Challenger Card
          </Button>

          {status && <p className="text-sm mt-2 text-white">{status}</p>}
        </CardContent>
      </Card>
    </Layout>
  )
}
