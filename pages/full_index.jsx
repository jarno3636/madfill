// pages/index.jsx
import { useState, useEffect, Fragment } from 'react'
import Head from 'next/head'
import { ethers, formatBytes32String } from 'ethers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import abi from '../abi/FillInStoryFull.json'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Countdown } from '@/components/Countdown'

export default function Home() {
  // Wallet & UI state
  const [address, setAddress] = useState(null)
  const [signer, setSigner]   = useState(null)
  const [busy, setBusy]       = useState(false)
  const [status, setStatus]   = useState('')

  // Recent winners
  const [recentWinners, setRecentWinners] = useState([])

  // Nav helper
  const navigate = (path) => (window.location.href = path)

  // Categories & Templates (7 categories × 5 templates)
  const categories = [
    {
      name: 'Cryptocurrency',
      templates: [
        { id: 'crypto1', name: 'Crypto Chaos', blanks: 5,
          parts: [
            'When Bitcoin soared to ',
            ', the community yelled ',
            '; later it dipped to ',
            ', yet traders still ',
            ', and then ',
            '.'
          ]
        },
        { id: 'crypto2', name: 'To the Moon', blanks: 5,
          parts: [
            'Every time ',
            ' tweets about ',
            ', price rockets to ',
            '! Meanwhile ',
            ' investors ',
            '.'
          ]
        },
        { id: 'crypto3', name: 'HODL Story', blanks: 5,
          parts: [
            'I bought ',
            ' at ',
            ' and promised to ',
            ' forever if it reached ',
            '.'
          ]
        },
        { id: 'crypto4', name: 'NFT Frenzy', blanks: 5,
          parts: [
            'I minted a ',
            ' NFT for ',
            ', then sold at ',
            ' ETH and bought ',
            ', celebrating until ',
            '.'
          ]
        },
        { id: 'crypto5', name: 'Meme Coin', blanks: 5,
          parts: [
            'Dogecoin hit ',
            ' cents, I ',
            ' my portfolio, then yelled ',
            ', but still ',
            ', hoping for ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Funny',
      templates: [
        { id: 'funny1', name: 'Office Antics', blanks: 5,
          parts: [
            'During meetings, I always ',
            ' the notes, ',
            ' snacks for my team, ',
            ' coffee, ',
            ' and still ',
            '.'
          ]
        },
        { id: 'funny2', name: 'Cat Chronicles', blanks: 5,
          parts: [
            'My cat ',
            ' ate the ',
            ' when I was ',
            ', then ',
            ' and ',
            '.'
          ]
        },
        { id: 'funny3', name: 'Lottery Dreams', blanks: 5,
          parts: [
            'If I won the lottery, I would ',
            ' a ',
            ', give ',
            ' to my ',
            ' and ',
            '.'
          ]
        },
        { id: 'funny4', name: 'Awkward Zoom', blanks: 5,
          parts: [
            'On Zoom calls I always ',
            ', accidentally unmute and ',
            ', while ',
            ', then ',
            '.'
          ]
        },
        { id: 'funny5', name: 'Snack Attack', blanks: 5,
          parts: [
            'I hid ',
            ' in my desk, then stole ',
            ', invited ',
            ', before ',
            ', and finally ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Pop Culture',
      templates: [
        { id: 'pop1', name: 'May the Force', blanks: 5,
          parts: [
            'May the ',
            ' be with ',
            ', always ',
            ', even when ',
            ', because ',
            '.'
          ]
        },
        { id: 'pop2', name: 'Movie Tagline', blanks: 5,
          parts: [
            'In a world where ',
            ', one ',
            ' must ',
            ' to save ',
            '.'
          ]
        },
        { id: 'pop3', name: 'Music Lyrics', blanks: 5,
          parts: [
            'I got ',
            ' on my ',
            ', feeling ',
            ' like a ',
            ' tonight.'
          ]
        },
        { id: 'pop4', name: 'Superhero Intro', blanks: 5,
          parts: [
            'By day I am a ',
            ', but by night I ',
            ' to fight ',
            ', armed with ',
            '.'
          ]
        },
        { id: 'pop5', name: 'Reality TV', blanks: 5,
          parts: [
            'On the show ',
            ', drama erupts when ',
            ' confesses ',
            ', leading to ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Animals',
      templates: [
        { id: 'animal1', name: 'Jungle Chase', blanks: 5,
          parts: [
            'The ',
            ' chased the ',
            ' over the ',
            ', through ',
            ', until ',
            '.'
          ]
        },
        { id: 'animal2', name: 'Pet Routine', blanks: 5,
          parts: [
            'Every morning, my ',
            ' likes to ',
            ' before ',
            ', then ',
            '.'
          ]
        },
        { id: 'animal3', name: 'Wildlife Safari', blanks: 5,
          parts: [
            'On safari I spotted a ',
            ' eating ',
            ', chased by a ',
            ', which then ',
            '.'
          ]
        },
        { id: 'animal4', name: 'Farm Fable', blanks: 5,
          parts: [
            'Old MacDonald had a ',
            ', he said ',
            ' and then ',
            ', under the ',
            '.'
          ]
        },
        { id: 'animal5', name: 'Ocean Adventure', blanks: 5,
          parts: [
            'I swam with the ',
            ', fed them ',
            ', while a ',
            ' watched and ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Food',
      templates: [
        { id: 'food1', name: 'Cooking Show', blanks: 5,
          parts: [
            'First, chop the ',
            ' and sauté with ',
            '; then add ',
            ' and simmer until ',
            '.'
          ]
        },
        { id: 'food2', name: 'Pizza Order', blanks: 5,
          parts: [
            'I always get ',
            ' pizza with extra ',
            ', a side of ',
            ', and a drink of ',
            '.'
          ]
        },
        { id: 'food3', name: 'Burger Bliss', blanks: 5,
          parts: [
            'Stack a ',
            ' patty, add ',
            ', top with ',
            ' and ',
            '.'
          ]
        },
        { id: 'food4', name: 'Dessert Dreams', blanks: 5,
          parts: [
            'Serve ',
            ' topped with ',
            ', alongside ',
            ', drizzled with ',
            '.'
          ]
        },
        { id: 'food5', name: 'Spice Market', blanks: 5,
          parts: [
            'At the bazaar, I bought ',
            ' spice for ',
            ', to flavor ',
            ', and ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Adventure',
      templates: [
        { id: 'adv1', name: 'Space Voyage', blanks: 5,
          parts: [
            'I boarded the ',
            ' bound for ',
            ', equipped with ',
            ' and ',
            '.'
          ]
        },
        { id: 'adv2', name: 'Treasure Hunt', blanks: 5,
          parts: [
            'On the map, X marks ',
            '; we sailed to ',
            ', digging for ',
            ' under ',
            '.'
          ]
        },
        { id: 'adv3', name: 'Jungle Quest', blanks: 5,
          parts: [
            'Through the ',
            ', we trekked, chasing ',
            ', armed with ',
            ' and ',
            '.'
          ]
        },
        { id: 'adv4', name: 'Underwater Dive', blanks: 5,
          parts: [
            'Diving into ',
            ', I saw ',
            ', grabbed ',  
            ', then ',  
            '.'
          ]
        },
        { id: 'adv5', name: 'Mountain Climb', blanks: 5,
          parts: [
            'Climbing ',
            ' with ',
            ' gear, we braved ',
            ' winds, finally ',
            '.'
          ]
        },
      ],
    },
    {
      name: 'Movies',
      templates: [
        { id: 'mov1', name: 'Blockbuster', blanks: 5,
          parts: [
            'In a city plagued by ',
            ', one hero ',
            ' must ',
            ' to ',
            '.'
          ]
        },
        { id: 'mov2', name: 'Film Noir', blanks: 5,
          parts: [
            'It was a night of ',
            ', I lit a ',
            ', chased a ',
            ', and found ',
            '.'
          ]
        },
        { id: 'mov3', name: 'Rom-Com Plot', blanks: 5,
          parts: [
            'She spilled ',
            ' on ',
            ', so ',
            ' chased ',
            ' through ',
            '.'
          ]
        },
        { id: 'mov4', name: 'Sci-Fi Saga', blanks: 5,
          parts: [
            'On planet ',
            ', I met ',
            ', we battled ',
            ', and escaped on ',
            '.'
          ]
        },
        { id: 'mov5', name: 'Horror Story', blanks: 5,
          parts: [
            'The lights went out in ',
            ', I heard ',
            ', then ',
            ', before ',
            '.'
          ]
        },
      ],
    },
  ]

  // Template selection state
  const [catIdx, setCatIdx]   = useState(0)
  const [tplIdx, setTplIdx]   = useState(0)
  const selectedCategory      = categories[catIdx]
  const tpl                   = selectedCategory.templates[tplIdx]

  // Duration
  const durations = [
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 },
    { label: '4 Days', value: 4 },
    { label: '5 Days', value: 5 },
    { label: '6 Days', value: 6 },
    { label: '1 Week', value: 7 },
  ]
  const [duration, setDuration] = useState(1)

  // Submission state
  const ENTRY_FEE               = '0.001'
  const [roundId, setRoundId]   = useState('')
  const [blankIndex, setBlankIndex] = useState('0')
  const [word, setWord]         = useState('')
  const [mode, setMode]         = useState('paid') // 'paid' or 'free'

  // Deadline for countdown
  const [deadline, setDeadline] = useState(null)
  useEffect(() => {
    if (!roundId) { setDeadline(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const rpcContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi, provider
        )
        const info = await rpcContract.rounds(BigInt(roundId))
        const dl = info.sd.toNumber()
        if (!cancelled) setDeadline(dl)
      } catch {
        if (!cancelled) setDeadline(null)
      }
    })()
    return () => { cancelled = true }
  }, [roundId])

  // Fetch recent Draw1 winners
  useEffect(() => {
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
        const contract = new ethers.Contract(
          process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
          abi, provider
        )
        const events = await contract.queryFilter(contract.filters.Draw1(), 0, 'latest')
        const last5 = events.slice(-5).reverse().map(e => ({
          roundId: e.args.id.toNumber(),
          winner: e.args.winner
        }))
        setRecentWinners(last5)
      } catch (e) {
        console.error('Failed to load recent winners', e)
      }
    })()
  }, [])

  // Connect wallet
  async function connectWallet() {
    const modal = new Web3Modal({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            rpc: { 8453: 'https://mainnet.base.org' },
            chainId: 8453,
          }
        }
      }
    })
    try {
      const instance = await modal.connect()
      const provider = new ethers.BrowserProvider(instance)
      const _signer  = await provider.getSigner()
      const _address = await _signer.getAddress()
      setSigner(_signer)
      setAddress(_address)
    } catch (e) {
      alert('Wallet connection failed: ' + (e.message||e))
    }
  }

  // Unified create + submit
  async function handleUnifiedSubmit() {
    if (!signer) return connectWallet()
    setBusy(true)
    setStatus('')
    let newId = roundId
    try {
      const ct = new ethers.Contract(
        process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
        abi, signer
      )
      // Create round if none
      if (!roundId) {
        setStatus('⏳ Creating round…')
        const tx1 = await ct.start(
          tpl.blanks,
          ethers.parseEther(ENTRY_FEE),
          BigInt(duration*24*60*60)
        )
        await tx1.wait()
        // find last Started event
        const evs = await ct.queryFilter(ct.filters.Started(), 0, 'latest')
        newId = evs[evs.length-1].args.id.toString()
        setRoundId(newId)
        const info = await ct.rounds(BigInt(newId))
        setDeadline(info.sd.toNumber())
      }
      // Submit entry
      setStatus('⏳ Submitting entry…')
      const data = formatBytes32String(word)
      let tx2
      if (mode==='paid') {
        tx2 = await ct.submitPaid(
          BigInt(newId), Number(blankIndex), data,
          { value: ethers.parseEther(ENTRY_FEE) }
        )
      } else {
        tx2 = await ct.submitFree(BigInt(newId), Number(blankIndex), data)
      }
      await tx2.wait()
      setStatus(`✅ Round ${newId} ${mode} entry submitted! Tx: ${tx2.hash}`)
    } catch (e) {
      setStatus('❌ ' + (e.message||e))
    } finally {
      setBusy(false)
    }
  }

  // Styles
  const paperStyle = 'bg-gray-50 border border-gray-200 p-4 font-mono whitespace-pre-wrap my-4'
  const blankStyle = (active) =>
    `inline-block w-8 text-center border-b-2 ${active?'border-black':'border-gray-400'} cursor-pointer mx-1`

  return (
    <>
      <Head><title>MadFill</title></Head>
      <nav className="flex justify-between items-center p-4 bg-gray-100">
        <h1 className="text-xl font-bold cursor-pointer" onClick={()=>navigate('/')}>
          MadFill
        </h1>
        <div className="space-x-4">
          <a href="/" className="text-blue-600">Home</a>
          <a href="/active" className="text-blue-600">Active Rounds</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {/* How It Works */}
        <Card>
          <CardHeader><h2>How It Works</h2></CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              <li>Connect your wallet.</li>
              <li>Select category, template & duration, type your word.</li>
              <li>
                Click “{!roundId
                  ? 'Create & Submit'
                  : mode === 'paid'
                     ? 'Submit Paid'
                     : 'Submit Free (gas only)'}”
                — free entries still incur an on-chain gas fee.
<             </li>
              <li>Round is created (first click) then your entry is submitted.</li>
              <li>Winners drawn on-chain—browse Active Rounds for other pools.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Connect Wallet */}
        <Card>
          <CardContent className="text-center">
            <Button onClick={connectWallet} disabled={!!address||busy}>
              {address ? `👛 ${address}` : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>

        {/* Unified Card */}
        <Card>
          <CardHeader><h2>New Round & Submit Entry</h2></CardHeader>
          <CardContent className="space-y-4">
            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label>Category</label>
                <select
                  className="block w-full mt-1 border rounded px-2 py-1"
                  value={catIdx}
                  onChange={e=>{ setCatIdx(+e.target.value); setTplIdx(0) }}
                  disabled={busy}
                >
                  {categories.map((c,i)=><option key={i} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Template</label>
                <select
                  className="block w-full mt-1 border rounded px-2 py-1"
                  value={tplIdx}
                  onChange={e=>setTplIdx(+e.target.value)}
                  disabled={busy}
                >
                  {selectedCategory.templates.map((t,i)=>
                    <option key={t.id} value={i}>{t.name}</option>
                  )}
                </select>
              </div>
              <div>
                <label>Duration</label>
                <select
                  className="block w-full mt-1 border rounded px-2 py-1"
                  value={duration}
                  onChange={e=>setDuration(+e.target.value)}
                  disabled={busy}
                >
                  {durations.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            {/* Blanks */}
            <div className={paperStyle}>
              {tpl.parts.map((part,i)=>(
                <Fragment key={i}>
                  <span>{part}</span>
                  {i<tpl.blanks && (
                    <span
                      className={blankStyle(i===+blankIndex)}
                      onClick={()=>setBlankIndex(String(i))}
                    >{i}</span>
                  )}
                </Fragment>
              ))}
            </div>
            <p>Selected Blank: <strong>{blankIndex}</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label>Your Word</label>
                <input
                  type="text"
                  className="block w-full mt-1 border rounded px-2 py-1"
                  value={word}
                  onChange={e=>setWord(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex items-center space-x-4 mt-6">
                <label className="flex items-center space-x-2">
                  <input type="radio" value="paid" checked={mode==='paid'}
                    onChange={()=>setMode('paid')} disabled={busy} />
                  <span>Paid ({ENTRY_FEE} BASE)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" value="free" checked={mode === 'free'}
                    onChange={() => setMode('free')} disabled={busy} />
                  <span>Free (gas only)</span>
                </label>
              </div>
            </div>
            {/* Countdown & Submit */}
            {deadline && (
              <p className="text-sm">⏱️ Submissions close in: <Countdown targetTimestamp={deadline} /></p>
            )}
            <Button onClick={handleUnifiedSubmit} disabled={!word||busy}>
              {!roundId ? '🚀 Create & Submit' : (mode==='paid' ? '💸 Submit Paid' : '✏️ Submit Free')}
            </Button>
            {status && <p className="mt-2">{status}</p>}
          </CardContent>
        </Card>

        {/* Recent Winners */}
        <Card>
          <CardHeader><h2>🎉 Recent Winners</h2></CardHeader>
          <CardContent className="space-y-1">
            {recentWinners.length === 0
              ? <p>No winners yet.</p>
              : recentWinners.map((w,i)=>(
                  <p key={i}>
                    Round <strong>#{w.roundId}</strong> → <code>{w.winner}</code>
                  </p>
                ))
            }
          </CardContent>
        </Card>
      </main>
    </>
  )
}
