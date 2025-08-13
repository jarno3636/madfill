// jest.setup.js

// ------------- Testing DOM helpers -------------
import '@testing-library/jest-dom';

// ------------- Stable globals used by libs -------------
// Some browser-only libs reference `self`; make it exist in JSDOM.
if (typeof global.self === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global.self = global;
}

// TextEncoder/Decoder (used by Next, OG, some crypto libs)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Minimal crypto.getRandomValues for libs that expect it
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
}

// ------------- Public env vars used by the app -------------
process.env.NEXT_PUBLIC_FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b';

process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS =
  process.env.NEXT_PUBLIC_MADFILL_NFT_ADDRESS ||
  '0x0F22124A86F8893990fA4763393E46d97F4AF8E0c';

process.env.NEXT_PUBLIC_BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';

process.env.NEXT_PUBLIC_CHAIN_ID =
  process.env.NEXT_PUBLIC_CHAIN_ID || '8453';

// ------------- next/router mock -------------
jest.mock('next/router', () => {
  const listeners = { routeChangeComplete: new Set() };

  return {
    useRouter() {
      return {
        route: '/',
        pathname: '/',
        query: {},
        asPath: '/',
        push: jest.fn(async () => true),
        replace: jest.fn(async () => true),
        reload: jest.fn(),
        back: jest.fn(),
        prefetch: jest.fn().mockResolvedValue(undefined),
        beforePopState: jest.fn(),
        events: {
          on: jest.fn((evt, cb) => {
            if (evt === 'routeChangeComplete') listeners.routeChangeComplete.add(cb);
          }),
          off: jest.fn((evt, cb) => {
            if (evt === 'routeChangeComplete') listeners.routeChangeComplete.delete(cb);
          }),
          emit: jest.fn((evt, url) => {
            if (evt === 'routeChangeComplete') {
              listeners.routeChangeComplete.forEach((cb) => cb(url));
            }
          }),
        },
      };
    },
  };
});

// ------------- next/head & next/link & next/script mocks -------------
jest.mock('next/head', () => function Head({ children }) { return children; });

jest.mock('next/link', () => {
  return function Link({ href, children, ...rest }) {
    // Render a simple anchor for tests
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>;
  };
});

jest.mock('next/script', () => {
  return function Script() { return null; };
});

// ------------- window.ethereum mock (kept lightweight) -------------
Object.defineProperty(window, 'ethereum', {
  configurable: true,
  writable: true,
  value: {
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    isMetaMask: true,
  },
});

// ------------- Ethers v6 mock -------------
// The app uses v6-style APIs, e.g. ethers.formatEther, parseEther, JsonRpcProvider, BrowserProvider, Contract.
jest.mock('ethers', () => {
  const toWei = (v) => {
    // Accept string/number
    const s = typeof v === 'number' ? String(v) : String(v || '0');
    // Very naive parser for tests
    if (s.includes('.')) {
      const [a, bRaw] = s.split('.');
      const b = (bRaw + '000000000000000000').slice(0, 18);
      return BigInt(a || '0') * (10n ** 18n) + BigInt(b || '0');
    }
    return BigInt(s) * (10n ** 18n);
  };

  const fromWei = (bn) => {
    const neg = bn < 0n;
    const val = neg ? -bn : bn;
    const int = val / (10n ** 18n);
    const frac = (val % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + (frac ? `${int}.${frac}` : `${int}`);
  };

  class MockJsonRpcProvider {
    constructor() {}
    async getNetwork() { return { chainId: 8453n }; }
  }

  class MockBrowserProvider {
    constructor() {}
    async getSigner() { return {}; }
    async getNetwork() { return { chainId: 8453n }; }
  }

  class MockContract {
    constructor() {}
    async pool1Count() { return 0n; }
    getPool1Info = jest.fn();
    createPool1 = jest.fn();
    joinPool1 = jest.fn();
  }

  return {
    // Named export commonly used as `import { ethers } from 'ethers'`
    ethers: {
      JsonRpcProvider: MockJsonRpcProvider,
      BrowserProvider: MockBrowserProvider,
      Contract: MockContract,
      parseEther: (v) => toWei(v),
      formatEther: (v) => fromWei(BigInt(v || 0n)),
      isAddress: (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
    },
    // Also support direct named imports if any file uses them
    JsonRpcProvider: MockJsonRpcProvider,
    BrowserProvider: MockBrowserProvider,
    Contract: MockContract,
    parseEther: (v) => toWei(v),
    formatEther: (v) => fromWei(BigInt(v || 0n)),
    isAddress: (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  };
});

// ------------- Farcaster MiniApp SDK mock -------------
jest.mock('@farcaster/miniapp-sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    authenticate: jest.fn(),
    logout: jest.fn(),
  })),
}));

// ------------- Console noise control -------------
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('componentWillReceiveProps')) return;
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});
