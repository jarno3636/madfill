import { renderHook, waitFor } from '@testing-library/react'
import { useContracts } from '../../hooks/useContracts'

// Mock the useMiniWallet hook
jest.mock('../../hooks/useMiniWallet', () => ({
  useMiniWallet: () => ({
    address: '0x123...',
    isConnected: true
  })
}))

describe('useContracts', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.NEXT_PUBLIC_FILLIN_ADDRESS = '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
    process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS = '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'
  })

  it('should initialize contracts when connected', async () => {
    const { result } = renderHook(() => useContracts())
    
    expect(result.current.isLoading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.contracts).toBeTruthy()
    expect(result.current.addresses).toEqual({
      FILL_IN_STORY: '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b',
      MAD_FILL_NFT: '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'
    })
  })

  it('should provide contract interaction methods', async () => {
    const { result } = renderHook(() => useContracts())
    
    await waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    expect(typeof result.current.createPool1).toBe('function')
    expect(typeof result.current.joinPool1).toBe('function')
    expect(typeof result.current.getPool1Info).toBe('function')
    expect(typeof result.current.getPool1Count).toBe('function')
  })
})