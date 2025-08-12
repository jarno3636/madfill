import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_FILLIN_ADDRESS = '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS = '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c'
process.env.NEXT_PUBLIC_BASE_RPC = 'https://mainnet.base.org'
process.env.NEXT_PUBLIC_CHAIN_ID = '8453'

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  writable: true,
  value: {
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    isMetaMask: true,
  },
})

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock next/head
jest.mock('next/head', () => {
  return function Head({ children }) {
    return children
  }
})

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 8453n }),
    })),
    BrowserProvider: jest.fn(() => ({
      getSigner: jest.fn().mockResolvedValue({}),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 8453n }),
    })),
    Contract: jest.fn(() => ({
      pool1Count: jest.fn().mockResolvedValue(BigInt(0)),
      getPool1Info: jest.fn(),
      createPool1: jest.fn(),
      joinPool1: jest.fn(),
    })),
    parseEther: jest.fn((value) => BigInt(value) * BigInt(10 ** 18)),
    formatEther: jest.fn((value) => (Number(value) / 10 ** 18).toString()),
  },
}))

// Mock Farcaster SDK
jest.mock('@farcaster/miniapp-sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    authenticate: jest.fn(),
    logout: jest.fn(),
  })),
}))

// Suppress console warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})