// tests/hooks/useContracts.test.js

import { renderHook, waitFor } from '@testing-library/react'
import { useContracts } from '../../hooks/useContracts'

// Mock the useMiniWallet hook to simulate a connected user
jest.mock('../../hooks/useMiniWallet', () => ({
  useMiniWallet: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isConnected: true,
    chainId: 8453,
  }),
}))

describe('useContracts', () => {
  beforeEach(() => {
    // Ensure env is set for contract addresses
    process.env.NEXT_PUBLIC_FILLIN_ADDRESS =
      '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
    process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS =
      '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'
  })

  it('initializes and exposes basic contract state', async () => {
    const { result } = renderHook(() => useContracts())

    // Starts loading
    expect(result.current?.isLoading).toBe(true)

    // Wait for init to complete
    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false)
    })

    // Contracts object should exist once ready
    expect(result.current?.contracts).toBeTruthy()
    expect(typeof result.current?.isReady).toBe('boolean')
    expect(result.current?.addresses).toEqual({
      FILL_IN_STORY: '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
      MAD_FILL_NFT: '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c',
    })
  })

  it('provides expected interaction methods when ready', async () => {
    const { result } = renderHook(() => useContracts())

    await waitFor(() => {
      expect(result.current?.isReady).toBe(true)
    })

    // These are the methods our hook is expected to surface
    // (backed by ethers.Contract mocks from jest.setup.js)
    expect(typeof result.current?.createPool1).toBe('function')
    expect(typeof result.current?.joinPool1).toBe('function')
    expect(typeof result.current?.getPool1Info).toBe('function')
    expect(typeof result.current?.getPool1Count).toBe('function')
  })
})
