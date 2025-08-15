// lib/tx.js
import { ethers } from 'ethers'
import { getBrowserProvider, ensureBaseChain, BASE_RPC } from './wallet'
import FillInAbi from '@/abi/FillInStoryV3_ABI.json'
import TemplateAbi from '@/abi/MadFillTemplateNFT_ABI.json'

const IFaceFill = new ethers.Interface(FillInAbi)
const IFaceTpl  = new ethers.Interface(TemplateAbi)

const FILLIN_ADDRESS =
  process.env.NEXT_PUBLIC_FILLIN_ADDRESS ||
  '0x18b2d2993fc73407C163Bd32e73B1Eea0bB4088b' // fallback

const TEMPLATE_NFT_ADDRESS =
  process.env.NEXT_PUBLIC_TEMPLATE_NFT_ADDRESS || '' // <- set this in Vercel

/* ----------------- Revert decoding ----------------- */
function decodeRevertData(data, iface) {
  if (!data || data === '0x') return null
  try {
    const parsed = iface.parseError(data)
    if (parsed) return { name: parsed.name, args: parsed.args?.map(String) ?? [] }
  } catch {}
  // Also try Error(string)
  try {
    const errIface = new ethers.Interface(['function Error(string)'])
    const [reason] = errIface.decodeErrorResult('Error', data)
    return { name: 'Error', args: [String(reason)] }
  } catch {}
  return null
}

function throwDecoded(e, iface) {
  const payload = e?.data || e?.error?.data || e?.info?.error?.data || null
  const dec = decodeRevertData(payload, iface)
  if (dec?.name) {
    const nice =
      dec.name === 'OwnableUnauthorizedAccount' ? 'Unauthorized (owner only).' :
      dec.name === 'ERC721InvalidReceiver' ? 'Invalid ERC721 receiver.' :
      (dec.name === 'Error' && dec.args?.[0]) ? dec.args[0] :
      `${dec.name}${dec?.args?.length ? ` (${dec.args.join(', ')})` : ''}`
    throw new Error(nice || 'Transaction would revert.')
  }
  throw new Error('Transaction would revert (no reason).')
}

/* ----------------- Read helpers ----------------- */
export async function readPool1Info(id) {
  const rp = new ethers.JsonRpcProvider(BASE_RPC)
  const ct = new ethers.Contract(FILLIN_ADDRESS, FillInAbi, rp)
  const info = await ct.getPool1Info(BigInt(id))
  return {
    name: info.name_ ?? info[0],
    theme: info.theme_ ?? info[1],
    parts: info.parts_ ?? info[2],
    feeBaseWei: BigInt(info.feeBase_ ?? info[3] ?? 0n),
    deadline: Number(info.deadline_ ?? info[4] ?? 0),
    creator: info.creator_ ?? info[5],
    participants: info.participants_ ?? info[6] ?? [],
    winner: info.winner_ ?? info[7],
    claimed: Boolean(info.claimed_ ?? info[8]),
    poolBalance: BigInt(info.poolBalance_ ?? info[9] ?? 0n),
  }
}

export async function readMintPriceWei() {
  if (!TEMPLATE_NFT_ADDRESS) throw new Error('Template NFT address not configured')
  const rp = new ethers.JsonRpcProvider(BASE_RPC)
  const ct = new ethers.Contract(TEMPLATE_NFT_ADDRESS, TemplateAbi, rp)
  return BigInt(await ct.getMintPriceWei())
}

/* ------------- Preflight (eth_call) utilities -------------- */
async function preflightCall({ provider, to, data, value, iface }) {
  const from = await (await provider.getSigner()).getAddress()
  try {
    await provider.send('eth_call', [{ from, to, data, value: value ? ethers.toBeHex(value) : undefined }, 'latest'])
  } catch (e) {
    throwDecoded(e, iface)
  }
  let gasLimit
  try {
    gasLimit = await provider.estimateGas({ from, to, data, value })
  } catch {
    // ignore: we already know it doesn't revert
  }
  return { gasLimit }
}

/* ----------------- FillIn: join & create ----------------- */
export async function joinPool1Tx({ id, word, username, blankIndex, expectedFeeWei }) {
  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  await ensureBaseChain(provider)

  const data = IFaceFill.encodeFunctionData('joinPool1', [
    BigInt(id),
    String(word),
    String(username || ''),
    Number(blankIndex) & 0xff,
  ])

  await preflightCall({
    provider,
    to: FILLIN_ADDRESS,
    data,
    value: expectedFeeWei,
    iface: IFaceFill,
  })

  const signer = await provider.getSigner()
  const ct = new ethers.Contract(FILLIN_ADDRESS, FillInAbi, signer)
  return ct.joinPool1(
    BigInt(id),
    String(word),
    String(username || ''),
    Number(blankIndex) & 0xff,
    { value: expectedFeeWei }
  )
}

export async function createPool1Tx({
  title, theme, parts, word, username, feeBaseWei, durationSecs, blankIndex,
}) {
  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  await ensureBaseChain(provider)

  const data = IFaceFill.encodeFunctionData('createPool1', [
    String(title).slice(0, 128),
    String(theme).slice(0, 128),
    parts,
    String(word),
    String(username || ''),
    BigInt(feeBaseWei),
    BigInt(durationSecs),
    Number(blankIndex) & 0xff,
  ])
  // createPool1 is payable with { value: feeBaseWei }
  await preflightCall({
    provider,
    to: FILLIN_ADDRESS,
    data,
    value: BigInt(feeBaseWei),
    iface: IFaceFill,
  })

  const signer = await provider.getSigner()
  const ct = new ethers.Contract(FILLIN_ADDRESS, FillInAbi, signer)
  return ct.createPool1(
    String(title).slice(0, 128),
    String(theme).slice(0, 128),
    parts,
    String(word),
    String(username || ''),
    BigInt(feeBaseWei),
    BigInt(durationSecs),
    Number(blankIndex) & 0xff,
    { value: BigInt(feeBaseWei) }
  )
}

/* ----------------- Template NFT: mint ----------------- */
export async function mintTemplateTx({ title, description, theme, parts }) {
  if (!TEMPLATE_NFT_ADDRESS) throw new Error('Template NFT address not configured')

  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  await ensureBaseChain(provider)

  // fetch on-chain price so we don’t guess value inside Warpcast
  const priceWei = await readMintPriceWei()

  const data = IFaceTpl.encodeFunctionData('mintTemplate', [
    String(title).slice(0, 128),
    String(description || '').slice(0, 512),
    String(theme || '').slice(0, 64),
    parts,
  ])

  await preflightCall({
    provider,
    to: TEMPLATE_NFT_ADDRESS,
    data,
    value: priceWei,
    iface: IFaceTpl,
  })

  const signer = await provider.getSigner()
  const ct = new ethers.Contract(TEMPLATE_NFT_ADDRESS, TemplateAbi, signer)
  return ct.mintTemplate(
    String(title).slice(0, 128),
    String(description || '').slice(0, 512),
    String(theme || '').slice(0, 64),
    parts,
    { value: priceWei }
  )
}
