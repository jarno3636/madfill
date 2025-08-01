import { useState } from 'react'
import { useAccount, usePrepareContractWrite, useContractWrite } from 'wagmi'
import FillInAbi from '../abi/FillInStoryFull.json'

export default function Home() {
  const { address, isConnected } = useAccount()
  const [blanks, setBlanks] = useState(3)
  const [fee, setFee] = useState('1000000000000000')
  const [windowSec, setWindowSec] = useState('300')

  const { config } = usePrepareContractWrite({
    address: process.env.NEXT_PUBLIC_FILLIN_ADDRESS as `0x${string}`,
    abi: FillInAbi,
    functionName: 'start',
    args: [blanks, BigInt(fee), BigInt(windowSec)],
  })
  const { write, isLoading, isSuccess } = useContractWrite(config)

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Fill-In Story Mini App</h1>

      {!isConnected ? (
        <button onClick={() => (window as any).ethereum.request({ method: 'eth_requestAccounts' })}>
          Connect Wallet
        </button>
      ) : (
        <>
          <p>👛 {address}</p>
          <label>
            # Blanks:
            <input
              type="number"
              value={blanks}
              min={1}
              max={10}
              onChange={(e) => setBlanks(+e.target.value)}
            />
          </label>
          <br />
          <label>
            Entry Fee (wei):
            <input type="text" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <br />
          <label>
            Window (sec):
            <input type="text" value={windowSec} onChange={(e) => setWindowSec(e.target.value)} />
          </label>
          <br />
          <button disabled={!write || isLoading} onClick={() => write?.()}>
            {isLoading ? 'Starting...' : 'Start Round'}
          </button>
          {isSuccess && <p>✅ Transaction sent!</p>}
        </>
      )}
    </main>
  )
}
