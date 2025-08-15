// /lib/tx.js
import { ethers } from 'ethers'
import { ensureBaseChain, getBrowserProvider, getReadProvider } from '@/lib/wallet'
import POOLS_ABI from '@/abi/FillInStoryV3_ABI.json'
import NFT_ABI from '@/abi/MadFillTemplateNFT_ABI.json'

export const POOLS_ADDR = process.env.NEXT_PUBLIC_FILLIN_ADDRESS || '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b'
export const NFT_ADDR   = process.env.NEXT_PUBLIC_TEMPLATE_NFT_ADDRESS || ''

export function poolsRead() {
  return new ethers.Contract(POOLS_ADDR, POOLS_ABI, getReadProvider())
}

export function templateRead() {
  if (!NFT_ADDR) throw new Error('NFT address missing: set NEXT_PUBLIC_TEMPLATE_NFT_ADDRESS')
  return new ethers.Contract(NFT_ADDR, NFT_ABI, getReadProvider())
}

async function signerContract(addr, abi) {
  const bp = await getBrowserProvider()
  if (!bp) throw new Error('No wallet provider available')
  await ensureBaseChain(bp.provider)
  const signer = await bp.getSigner()
  return new ethers.Contract(addr, abi, signer)
}

export async function poolsWrite()  { return signerContract(POOLS_ADDR, POOLS_ABI) }
export async function templateWrite(){ 
  if (!NFT_ADDR) throw new Error('NFT address missing: set NEXT_PUBLIC_TEMPLATE_NFT_ADDRESS')
  return signerContract(NFT_ADDR, NFT_ABI)
}

export async function createPool1Tx(p) {
  const ct = await poolsWrite()
  await ct.createPool1.staticCall(p.title, p.theme, p.parts, p.word, p.username, p.feeBaseWei, p.durationSecs, p.blankIndex, { value: p.feeBaseWei })
  const tx = await ct.createPool1(p.title, p.theme, p.parts, p.word, p.username, p.feeBaseWei, p.durationSecs, p.blankIndex, { value: p.feeBaseWei })
  return tx.wait()
}

export async function joinPool1Tx(id, word, username, blankIndex, valueWei) {
  const ct = await poolsWrite()
  await ct.joinPool1.staticCall(id, word, username, blankIndex, { value: valueWei })
  const tx = await ct.joinPool1(id, word, username, blankIndex, { value: valueWei })
  return tx.wait()
}

export async function claimPool1Tx(id) {
  const ct = await poolsWrite()
  await ct.claimPool1.staticCall(id)
  const tx = await ct.claimPool1(id)
  return tx.wait()
}

export async function mintTemplateTx(title, description, theme, parts, valueWei) {
  const ct = await templateWrite()
  await ct.mintTemplate.staticCall(title, description, theme, parts, { value: valueWei })
  const tx = await ct.mintTemplate(title, description, theme, parts, { value: valueWei })
  return tx.wait()
}
