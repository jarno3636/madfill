// lib/contracts/fillInContract.js

import FillInStoryV3_ABI from '@/abi/FillInStoryV3_ABI.json'

// Prefer env, fall back to known deployment (Base mainnet)
const ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

// Light runtime sanity check (does not crash build)
if (typeof ADDRESS !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(ADDRESS)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[contracts] fillInContract address looks invalid. Check NEXT_PUBLIC_FILLIN_ADDRESS.'
  )
}

/**
 * Read-only contract metadata for FillInStoryV3 on Base.
 * Frozen to prevent accidental mutation.
 */
export const fillInContract = Object.freeze({
  address: ADDRESS,
  abi: FillInStoryV3_ABI,
})
