// /lib/tx.js
import { ethers } from 'ethers'
import { getBrowserProvider, ensureAccounts, ensureBaseChain, readProvider, extractError } from './wallet'
import FILLIN_ABI from '@/abi/FillInStoryV3_ABI.json'

export const FILLIN_ADDR =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'

// READ helpers
export function fillinRead() {
  return new ethers.Contract(FILLIN_ADDR, FILLIN_ABI, readProvider)
}

// WRITE helpers (Mini App + browser wallets)
export async function fillinWrite() {
  const browser = await getBrowserProvider()
  await ensureBaseChain(browser)
  await ensureAccounts(browser)
  const signer = await browser.getSigner()
  return new ethers.Contract(FILLIN_ADDR, FILLIN_ABI, signer)
}

/* ---------- tx wrappers ---------- */
export async function createPool1Tx({
  title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
}) {
  const ct = await fillinWrite()
  // preflight
  await ct.createPool1.staticCall(
    String(title).slice(0,128),
    String(theme).slice(0,128),
    parts,
    word,
    String(username || '').slice(0,64),
    feeBaseWei,
    durationSecs,
    Number(blankIndex) & 0xff,
    { value: feeBaseWei }
  )
  const tx = await ct.createPool1(
    String(title).slice(0,128),
    String(theme).slice(0,128),
    parts,
    word,
    String(username || '').slice(0,64),
    feeBaseWei,
    durationSecs,
    Number(blankIndex) & 0xff,
    { value: feeBaseWei }
  )
  return tx.wait()
}

export async function joinPool1Tx({
  id, word, username, blankIndex, feeBaseWei,
}) {
  const ct = await fillinWrite()
  await ct.joinPool1.staticCall(
    BigInt(id),
    word,
    String(username || '').slice(0,32),
    Number(blankIndex) & 0xff,
    { value: feeBaseWei }
  )
  const tx = await ct.joinPool1(
    BigInt(id),
    word,
    String(username || '').slice(0,32),
    Number(blankIndex) & 0xff,
    { value: feeBaseWei }
  )
  return tx.wait()
}

export async function claimPool1Tx({ id }) {
  const ct = await fillinWrite()
  await ct.claimPool1.staticCall(BigInt(id))
  const tx = await ct.claimPool1(BigInt(id))
  return tx.wait()
}

/* ---------- tiny utils ---------- */
export const toEth = (wei) => {
  try {
    const bi = typeof wei === 'bigint' ? wei : BigInt(wei?.toString?.() ?? '0')
    return Number(ethers.formatEther(bi))
  } catch { return 0 }
}
export { extractError }
