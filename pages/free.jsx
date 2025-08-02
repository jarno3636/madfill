// pages/free.jsx
import Layout from '@/components/Layout'
import Head from 'next/head'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'

export default function FreeGamePage() {
  return (
    <Layout>
      <Head><title>🎁 Free Game | MadFill</title></Head>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-gradient-to-tr from-green-800 to-teal-800 text-white shadow-2xl rounded-xl">
          <CardHeader><h2 className="text-2xl font-bold">🎁 Welcome to Free MadFill!</h2></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>This is the <strong>free version</strong> of MadFill — no BASE required to play!</p>
            <p>You can fill in templates and submit entries just for fun. No prize pool, just laughs.</p>
            <p>Perfect for trying it out or playing casually with friends.</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
        <Card className="bg-gradient-to-br from-slate-800 to-sky-800 text-white shadow-xl rounded-xl mt-8">
          <CardHeader><h2 className="text-xl font-bold">🧩 Free Game Coming Soon</h2></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>The free game mode is under construction — you’ll soon be able to:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Choose fun templates</li>
              <li>Submit goofy answers</li>
              <li>Vote for the funniest combos</li>
            </ul>
            <p className="italic">We’re making it awesome — check back soon! 🚀</p>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  )
}
