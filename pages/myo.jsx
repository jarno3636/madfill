// pages/myo.jsx
import Head from 'next/head'
import Layout from '@/components/Layout'
import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MYOPage() {
  const [blanks, setBlanks] = useState(2)
  const [parts, setParts] = useState(['', '', ''])

  function updatePart(index, value) {
    const updated = [...parts]
    updated[index] = value
    setParts(updated)
  }

  const preview = parts.map((part, i) =>
    i < blanks ? `${part}[____]` : part
  ).join('')

  return (
    <Layout>
      <Head><title>Make Your Own | MadFill</title></Head>
      <Card className="bg-gradient-to-br from-slate-800 to-purple-800 text-white shadow-xl rounded-xl">
        <CardHeader>
          <h2 className="text-xl font-bold">🎨 Make Your Own MadFill</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Create your own custom fill-in-the-blank card and share it with friends!</p>

          <div>
            <label>Number of blanks (1–5):</label>
            <input
              type="number"
              value={blanks}
              min={1}
              max={5}
              className="mt-1 block w-full bg-slate-900 text-white px-2 py-1 rounded"
              onChange={(e) => {
                const n = Number(e.target.value)
                setBlanks(n)
                setParts(Array(n + 1).fill(''))
              }}
            />
          </div>

          {parts.map((p, i) => (
            <div key={i}>
              <label>Part {i + 1}:</label>
              <input
                type="text"
                value={p}
                className="mt-1 block w-full bg-slate-900 text-white px-2 py-1 rounded"
                onChange={(e) => updatePart(i, e.target.value)}
              />
            </div>
          ))}

          <div className="p-4 bg-slate-900 border border-slate-700 rounded text-sm font-mono">
            <p><strong>Preview:</strong></p>
            <p>{preview}</p>
          </div>

          <Button className="bg-indigo-600 hover:bg-indigo-500 w-full">📤 Share This</Button>
        </CardContent>
      </Card>
    </Layout>
  )
}
