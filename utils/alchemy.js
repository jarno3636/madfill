// utils/alchemy.js

/**
 * Alchemy client factory for Base.
 * - Lazy-initialized (no module-scope throws) to keep SSR/Vercel builds safe.
 * - Selects Base mainnet or Base Sepolia based on NEXT_PUBLIC_CHAIN_ID.
 * - Returns `null` when no API key is configured so callers can handle gracefully.
 *
 * Usage:
 *   const alchemy = getAlchemy();
 *   if (!alchemy) { /* handle missing key (disable feature, show message, etc.) *\/ }
 */

import { Alchemy, Network } from 'alchemy-sdk';

/** Map chain id -> Alchemy Network enum */
function getBaseNetwork() {
  const cid = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453'); // default Base mainnet
  // Known Base ids:
  // 8453  -> Base Mainnet
  // 84532 -> Base Sepolia
  return cid === 84532 ? Network.BASE_SEPOLIA : Network.BASE_MAINNET;
}

let _alchemy = null;

/**
 * Get (or create) the singleton Alchemy instance.
 * @returns {Alchemy | null}
 */
export function getAlchemy() {
  if (_alchemy) return _alchemy;

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      // Avoid crashing builds; surface a clear warning in dev/test
      // eslint-disable-next-line no-console
      console.warn('[alchemy] Missing NEXT_PUBLIC_ALCHEMY_KEY. Features depending on Alchemy are disabled.');
    }
    return null;
  }

  _alchemy = new Alchemy({
    apiKey,
    network: getBaseNetwork(),
  });

  return _alchemy;
}

/**
 * Optional helper that throws if Alchemy is unavailable.
 * Use when the feature is hard-required (e.g., API route).
 */
export function requireAlchemy() {
  const client = getAlchemy();
  if (!client) {
    throw new Error('Alchemy is not configured. Set NEXT_PUBLIC_ALCHEMY_KEY in your environment.');
  }
  return client;
}
