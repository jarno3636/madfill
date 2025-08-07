// pages/active.jsx

// [keep all imports the same... no changes needed there]

export default function ActivePools() {
  // ... [state + loadPrice unchanged]

  const loadRounds = async () => {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const ct = new ethers.Contract(process.env.NEXT_PUBLIC_FILLIN_ADDRESS, abi, provider)

    const count = await ct.pool1Count()
    const now = Math.floor(Date.now() / 1000)
    const all = []

    for (let i = 1; i <= count; i++) {
      try {
        const info = await ct.getPool1Info(BigInt(i))
        const name = info[0]
        const theme = info[1]
        const parts = info[2]
        const feeBase = Number(info[3]) / 1e18
        const deadline = Number(info[4])
        const participants = info[6]
        const claimed = info[8]

        if (!claimed && deadline > now) {
          const avatars = await Promise.all(
            participants.slice(0, 5).map(async (addr) => {
              const res = await fetchFarcasterProfile(addr)
              return {
                address: addr,
                avatar: res?.pfp_url || `https://effigy.im/a/${addr.toLowerCase()}`,
                username: res?.username || addr.slice(2, 6).toUpperCase()
              }
            })
          )

          const poolUsd = baseUsd * participants.length * feeBase

          all.push({
            id: i,
            name: name || 'Untitled',
            theme,
            parts,
            feeBase: feeBase.toFixed(4),
            deadline,
            count: participants.length,
            usd: poolUsd.toFixed(2),
            participants: avatars,
            badge: deadline - now < 3600 ? '🔥 Ends Soon' : poolUsd > 5 ? '💰 Top Pool' : null,
            emoji: ['🐸', '🦊', '🦄', '🐢', '🐙'][i % 5]
          })
        }
      } catch (e) {
        console.warn(`Error loading round ${i}`, e)
      }
    }

    setRounds(all)
  }

  // ... [effects and sorting remain unchanged]

  return (
    <Layout>
      <Head>
        <title>MadFill – Active Rounds</title>
      </Head>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-4xl font-extrabold text-white drop-shadow">🧠 Active Rounds</h1>

        {/* [search, sort, filter bar remains unchanged] */}

        {paginated.length === 0 ? (
          <div className="text-white mt-8 text-lg text-center space-y-3">
            <p>No active rounds right now. Be the first to start one! 🚀</p>
            <Link href="/">
              <Button className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg">
                ➕ Create New Round
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map(r => (
              <Card
                key={r.id}
                className="relative bg-gradient-to-br from-slate-800 to-slate-900 text-white border border-slate-700 rounded-xl hover:shadow-xl transition-all duration-300"
              >
                <CardHeader className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{r.emoji}</div>
                    <div>
                      <h2 className="text-lg font-bold">#{r.id} — {r.name}</h2>
                      {r.badge && (
                        <span className="text-sm text-yellow-400 animate-pulse font-semibold">
                          {r.badge}
                        </span>
                      )}
                      <p className="text-xs text-slate-400 mt-1">Theme: {r.theme}</p>
                    </div>
                  </div>
                  <div className="text-sm font-mono mt-1">
                    <Countdown targetTimestamp={r.deadline} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 text-sm font-medium">
                  <p><strong>Entry Fee:</strong> {r.feeBase} BASE</p>
                  <p><strong>Participants:</strong> {r.count}</p>
                  <p><strong>Total Pool:</strong> ${r.usd}</p>

                  {/* Template Preview */}
                  <div className="bg-slate-700 p-2 rounded text-xs font-mono text-slate-200">
                    {r.parts.map((part, i) => (
                      <span key={i}>
                        {part}
                        {i < r.parts.length - 1 && (
                          <span className="text-yellow-300 font-bold">____</span>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex -space-x-2 overflow-hidden mt-2">
                    {r.participants.map((p, i) => (
                      <Image
                        key={i}
                        src={p.avatar}
                        alt={p.username}
                        title={`@${p.username}`}
                        width={32}
                        height={32}
                        className="rounded-full border border-white"
                      />
                    ))}
                  </div>
                  <Link href={`/round/${r.id}`}>
                    <Button className="mt-3 bg-indigo-600 hover:bg-indigo-500 w-full">
                      ✏️ Enter Round
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                className={`px-4 py-1 rounded-full ${
                  page === i + 1 ? 'bg-indigo-600' : 'bg-slate-700'
                } text-sm`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}
      </main>
    </Layout>
  )
}
