// pages/index.jsx
import { useState } from 'react'
import { useAccount, usePrepareContractWrite, useContractWrite } from 'wagmi'
import FillInAbi from '../abi/FillInStoryFull.json'

export default function Home() {
  const { address, isConnected } = useAccount()
  const [blanks, setBlanks] = useState(3)
  const [fee, setFee] = useState('1000000000000000')
  const [windowSec, setWindowSec] = useState('300')

  const { config } = usePrepareContractWrite({
    address: process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
    abi: FillInAbi,
    functionName: 'start',
    args: [blanks, BigInt(fee), BigInt(windowSec)],
  })
  const { write, isLoading, isSuccess } = useContractWrite(config)

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {/* ...same JSX as before, minus TS annotations... */}
    </main>
  )
}
